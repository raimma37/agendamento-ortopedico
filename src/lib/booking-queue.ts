import { Prisma, type Shift } from "@prisma/client";
import { prisma } from "./prisma";
import {
  generateProtocolCandidate,
  normalizePatientName,
  normalizeWhatsappE164,
  parseDateOnly,
} from "./normalize";
import { resolveDayQuotas } from "./availability";
import { dispatchWebhookEvent, type AppointmentWithRelations } from "./webhooks";

export interface BookAppointmentInput {
  patientName: string;
  whatsapp: string;
  date: string; // YYYY-MM-DD
  shift: Shift;
  insuranceId: string;
  visitTypeId: string;
  kneeOptionId: string;
  lgpdAccepted: boolean;
}

export type BookAppointmentResult =
  | {
      outcome: "CREATED";
      appointment: AppointmentWithRelations;
    }
  | {
      outcome: "DUPLICATE";
      appointment: AppointmentWithRelations;
      message: string;
    }
  | {
      outcome: "FULL" | "INVALID";
      error: string;
    };

interface QueueItem {
  input: BookAppointmentInput;
  isPrivatePriority: boolean;
  enqueuedAt: number;
  resolve: (result: BookAppointmentResult) => void;
  reject: (err: unknown) => void;
}

interface SlotBucket {
  queue: QueueItem[];
  processing: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

// Micro-janela de agrupamento (ms) para resolver disputas simultâneas pela mesma vaga
// garantindo prioridade silenciosa absoluta para Particular (isPrivatePriority: true).
const COALESCE_WINDOW_MS = 60;

const globalForQueue = globalThis as unknown as {
  slotBuckets?: Map<string, SlotBucket>;
};

const slotBuckets = globalForQueue.slotBuckets ?? new Map<string, SlotBucket>();
if (!globalForQueue.slotBuckets) {
  globalForQueue.slotBuckets = slotBuckets;
}

/**
 * Executa a reserva atômica no banco dentro de transação Serializable.
 */
async function executeAtomicBooking(
  input: BookAppointmentInput,
  isPrivatePriority: boolean
): Promise<BookAppointmentResult> {
  const normalizedName = normalizePatientName(input.patientName);
  const normalizedWhatsapp = normalizeWhatsappE164(input.whatsapp);

  if (!normalizedWhatsapp) {
    return { outcome: "INVALID", error: "Número de WhatsApp inválido." };
  }

  const dateObj = parseDateOnly(input.date);

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const txResult = await prisma.$transaction(
        async (tx): Promise<BookAppointmentResult> => {
          // 1. Prevenção de duplicidade pelo nome normalizado na mesma data (exceto cancelados)
          const existing = await tx.appointment.findFirst({
            where: {
              patientNameNormalized: normalizedName,
              date: dateObj,
              status: { not: "CANCELED" },
            },
            include: {
              insurance: { select: { id: true, name: true } },
              visitType: { select: { id: true, name: true } },
              kneeOption: { select: { id: true, name: true } },
              location: { select: { id: true, name: true, address: true } },
            },
          });

          if (existing) {
            return {
              outcome: "DUPLICATE",
              appointment: existing,
              message:
                "Já existe um agendamento ativo para este paciente nesta data.",
            };
          }

          // 2. Validar opções fixas ativas (zero texto livre)
          const [insurance, visitType, kneeOption] = await Promise.all([
            tx.insuranceOption.findFirst({
              where: { id: input.insuranceId, active: true },
            }),
            tx.visitTypeOption.findFirst({
              where: { id: input.visitTypeId, active: true },
            }),
            tx.kneeOption.findFirst({
              where: { id: input.kneeOptionId, active: true },
            }),
          ]);

          if (!insurance || !visitType || !kneeOption) {
            return {
              outcome: "INVALID",
              error: "Uma ou mais opções selecionadas não estão disponíveis.",
            };
          }

          // 3. Resolver cota efetiva (DateException > WeeklyQuota)
          const dayQuotas = await resolveDayQuotas(input.date, tx);
          const shiftQuota = dayQuotas.find((q) => q.shift === input.shift);

          if (!shiftQuota || shiftQuota.isBlocked || shiftQuota.maxSlots <= 0) {
            return {
              outcome: "FULL",
              error: "Não há vagas disponíveis para a data e turno selecionados.",
            };
          }

          // 3b. Validar se o convênio selecionado é permitido nesta data/turno
          if (
            shiftQuota.allowedInsuranceIds.length > 0 &&
            !shiftQuota.allowedInsuranceIds.includes(insurance.id)
          ) {
            return {
              outcome: "INVALID",
              error: "Este convênio não é atendido na data e turno selecionados.",
            };
          }

          // 4. Contar agendamentos ativos (status != CANCELED)
          const activeCount = await tx.appointment.count({
            where: {
              date: dateObj,
              shift: input.shift,
              status: { not: "CANCELED" },
            },
          });

          // 5. Aplicar reserva silenciosa para Particular sem nunca expor o motivo
          const effectiveLimit =
            isPrivatePriority || insurance.isPrivatePriority
              ? shiftQuota.maxSlots
              : Math.max(0, shiftQuota.maxSlots - shiftQuota.privateReserveSlots);

          if (activeCount >= effectiveLimit) {
            return {
              outcome: "FULL",
              error: "As vagas para este turno já foram preenchidas.",
            };
          }

          // 6. Gerar protocolo único (AGD-XXXX)
          let protocol = generateProtocolCandidate();
          for (let tries = 0; tries < 10; tries++) {
            const existsProto = await tx.appointment.findUnique({
              where: { protocol },
              select: { id: true },
            });
            if (!existsProto) break;
            protocol = generateProtocolCandidate();
          }

          // 7. Criar agendamento
          const created = await tx.appointment.create({
            data: {
              protocol,
              patientName: input.patientName.trim(),
              patientNameNormalized: normalizedName,
              whatsapp: normalizedWhatsapp,
              date: dateObj,
              shift: input.shift,
              insuranceId: insurance.id,
              visitTypeId: visitType.id,
              kneeOptionId: kneeOption.id,
              locationId: shiftQuota.location?.id ?? null,
              status: "PENDING",
              lgpdAccepted: input.lgpdAccepted,
            },
            include: {
              insurance: { select: { id: true, name: true } },
              visitType: { select: { id: true, name: true } },
              kneeOption: { select: { id: true, name: true } },
              location: { select: { id: true, name: true, address: true } },
            },
          });

          return {
            outcome: "CREATED",
            appointment: created,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        }
      );

      if (txResult.outcome === "CREATED") {
        dispatchWebhookEvent("appointment.created", txResult.appointment);
      }

      return txResult;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "P2034" && attempt < MAX_RETRIES - 1) {
        // Conflito de serialização do PostgreSQL: tenta novamente
        continue;
      }
      throw err;
    }
  }

  return {
    outcome: "FULL",
    error: "As vagas para este turno já foram preenchidas.",
  };
}

async function drainBucket(key: string) {
  const bucket = slotBuckets.get(key);
  if (!bucket || bucket.processing) return;

  bucket.processing = true;
  bucket.timer = null;

  try {
    while (bucket.queue.length > 0) {
      // Ordena antes de cada retirada: Particular (isPrivatePriority=true) SEMPRE primeiro,
      // mantendo ordem de chegada (FIFO) dentro do mesmo grupo.
      bucket.queue.sort((a, b) => {
        if (a.isPrivatePriority !== b.isPrivatePriority) {
          return a.isPrivatePriority ? -1 : 1;
        }
        return a.enqueuedAt - b.enqueuedAt;
      });

      const next = bucket.queue.shift()!;
      try {
        const result = await executeAtomicBooking(
          next.input,
          next.isPrivatePriority
        );
        next.resolve(result);
      } catch (err) {
        next.reject(err);
      }
    }
  } finally {
    bucket.processing = false;
    if (bucket.queue.length === 0 && !bucket.timer) {
      slotBuckets.delete(key);
    }
  }
}

/**
 * Ponto único de criação de agendamentos (Portal Público + API v1).
 * Utiliza fila priorizada por (data, turno) com micro-janela de agrupamento
 * e transação Serializable para eliminar overbooking e aplicar prioridade silenciosa.
 */
export async function bookAppointmentWithPriority(
  input: BookAppointmentInput
): Promise<BookAppointmentResult> {
  // Consulta rápida da flag interna isPrivatePriority antes de enfileirar
  const insurance = await prisma.insuranceOption.findFirst({
    where: { id: input.insuranceId, active: true },
    select: { id: true, isPrivatePriority: true },
  });

  if (!insurance) {
    return {
      outcome: "INVALID",
      error: "Convênio selecionado não está disponível.",
    };
  }

  const key = `${input.date}:${input.shift}`;
  let bucket = slotBuckets.get(key);
  if (!bucket) {
    bucket = { queue: [], processing: false, timer: null };
    slotBuckets.set(key, bucket);
  }

  return new Promise<BookAppointmentResult>((resolve, reject) => {
    bucket!.queue.push({
      input,
      isPrivatePriority: insurance.isPrivatePriority,
      enqueuedAt: Date.now(),
      resolve,
      reject,
    });

    if (!bucket!.processing && !bucket!.timer) {
      bucket!.timer = setTimeout(() => {
        void drainBucket(key);
      }, COALESCE_WINDOW_MS);
    }
  });
}
