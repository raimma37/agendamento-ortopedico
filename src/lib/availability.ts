import type { Prisma, PrismaClient, Shift } from "@prisma/client";
import { prisma } from "./prisma";
import { addDaysISO, formatDateISO, parseDateOnly, SHIFT_LABELS } from "./normalize";

export interface ResolvedShiftQuota {
  shift: Shift;
  maxSlots: number;
  privateReserveSlots: number;
  source: "EXCEPTION" | "WEEKLY";
  isBlocked: boolean;
  reason: string | null;
}

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Resolve as cotas efetivas de um dia específico.
 * REGRA: DateException SEMPRE sobrescreve WeeklyQuota.
 */
export async function resolveDayQuotas(
  dateStr: string,
  db: DbClient = prisma
): Promise<ResolvedShiftQuota[]> {
  const dateObj = parseDateOnly(dateStr);
  const exceptions = await db.dateException.findMany({
    where: { date: dateObj },
  });

  if (exceptions.length > 0) {
    // Se houver bloqueio FULL_DAY, o dia inteiro está bloqueado
    const fullDayBlock = exceptions.find((e) => e.isBlocked && e.shift === "FULL_DAY");
    if (fullDayBlock) {
      return [];
    }

    return exceptions
      .filter((e) => !e.isBlocked && e.maxSlots > 0)
      .map((e) => ({
        shift: e.shift,
        maxSlots: e.maxSlots,
        privateReserveSlots: e.privateReserveSlots,
        source: "EXCEPTION" as const,
        isBlocked: false,
        reason: e.reason,
      }));
  }

  const dayOfWeek = dateObj.getUTCDay();
  const weekly = await db.weeklyQuota.findMany({
    where: { dayOfWeek, active: true, maxSlots: { gt: 0 } },
  });

  return weekly.map((w) => ({
    shift: w.shift,
    maxSlots: w.maxSlots,
    privateReserveSlots: w.privateReserveSlots,
    source: "WEEKLY" as const,
    isBlocked: false,
    reason: null,
  }));
}

export interface PublicShiftAvailability {
  shift: Shift;
  shiftLabel: string;
  available: boolean;
  /**
   * Nunca revela privateReserveSlots.
   * Quando showRemainingSlots=true e há vagas públicas livres, exibe o número;
   * caso contrário null.
   */
  remainingSlots: number | null;
}

export interface PublicDayAvailability {
  date: string;
  available: boolean;
  shifts: PublicShiftAvailability[];
}

export async function getAvailabilityRange(
  startDateStr: string,
  endDateStr: string,
  options: { forPublicPortal?: boolean; showRemainingSlots?: boolean } = {}
): Promise<PublicDayAvailability[]> {
  const { forPublicPortal = false, showRemainingSlots = true } = options;

  const startObj = parseDateOnly(startDateStr);
  const endObj = parseDateOnly(endDateStr);

  const [exceptions, weeklyQuotas, activeCounts] = await Promise.all([
    prisma.dateException.findMany({
      where: {
        date: { gte: startObj, lte: endObj },
      },
    }),
    prisma.weeklyQuota.findMany({
      where: { active: true, maxSlots: { gt: 0 } },
    }),
    prisma.appointment.groupBy({
      by: ["date", "shift"],
      where: {
        date: { gte: startObj, lte: endObj },
        status: { not: "CANCELED" },
      },
      _count: { _all: true },
    }),
  ]);

  const exceptionsByDate = new Map<string, typeof exceptions>();
  for (const ex of exceptions) {
    const key = formatDateISO(ex.date);
    const list = exceptionsByDate.get(key) ?? [];
    list.push(ex);
    exceptionsByDate.set(key, list);
  }

  const weeklyByDow = new Map<number, typeof weeklyQuotas>();
  for (const w of weeklyQuotas) {
    const list = weeklyByDow.get(w.dayOfWeek) ?? [];
    list.push(w);
    weeklyByDow.set(w.dayOfWeek, list);
  }

  const countMap = new Map<string, number>();
  for (const row of activeCounts) {
    const key = `${formatDateISO(row.date)}:${row.shift}`;
    countMap.set(key, row._count._all);
  }

  const shiftOrder: Record<Shift, number> = {
    MORNING: 1,
    AFTERNOON: 2,
    FULL_DAY: 3,
  };

  const results: PublicDayAvailability[] = [];
  let cursor = startDateStr;
  let safety = 0;

  while (cursor <= endDateStr && safety < 366) {
    safety++;
    const dateObj = parseDateOnly(cursor);
    const dayExceptions = exceptionsByDate.get(cursor);

    let effectiveQuotas: Array<{
      shift: Shift;
      maxSlots: number;
      privateReserveSlots: number;
    }> = [];

    if (dayExceptions && dayExceptions.length > 0) {
      const fullBlock = dayExceptions.find(
        (e) => e.isBlocked && e.shift === "FULL_DAY"
      );
      if (!fullBlock) {
        effectiveQuotas = dayExceptions
          .filter((e) => !e.isBlocked && e.maxSlots > 0)
          .map((e) => ({
            shift: e.shift,
            maxSlots: e.maxSlots,
            privateReserveSlots: e.privateReserveSlots,
          }));
      }
    } else {
      const dow = dateObj.getUTCDay();
      effectiveQuotas = (weeklyByDow.get(dow) ?? []).map((w) => ({
        shift: w.shift,
        maxSlots: w.maxSlots,
        privateReserveSlots: w.privateReserveSlots,
      }));
    }

    effectiveQuotas.sort((a, b) => shiftOrder[a.shift] - shiftOrder[b.shift]);

    const shifts: PublicShiftAvailability[] = effectiveQuotas.map((q) => {
      const booked = countMap.get(`${cursor}:${q.shift}`) ?? 0;
      const publicMax = Math.max(0, q.maxSlots - q.privateReserveSlots);
      const publicRemaining = Math.max(0, publicMax - booked);
      const totalRemaining = Math.max(0, q.maxSlots - booked);

      // No portal público (Passo 1 antes da escolha do convênio), mantemos o turno selecionável
      // enquanto houver qualquer vaga (inclusive reserva silenciosa para Particular).
      // Na API /v1/availability, exibimos apenas vagas públicas abertas.
      const isAvailable = forPublicPortal ? totalRemaining > 0 : publicRemaining > 0;

      let remainingSlots: number | null = null;
      if (showRemainingSlots) {
        if (forPublicPortal) {
          remainingSlots = publicRemaining > 0 ? publicRemaining : null;
        } else {
          remainingSlots = publicRemaining;
        }
      }

      return {
        shift: q.shift,
        shiftLabel: SHIFT_LABELS[q.shift],
        available: isAvailable,
        remainingSlots,
      };
    });

    results.push({
      date: cursor,
      available: shifts.some((s) => s.available),
      shifts,
    });

    cursor = addDaysISO(cursor, 1);
  }

  return results;
}
