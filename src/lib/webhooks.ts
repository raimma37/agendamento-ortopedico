import crypto from "node:crypto";
import type { Appointment, InsuranceOption, KneeOption, VisitTypeOption } from "@prisma/client";
import { prisma } from "./prisma";
import { formatDateISO, SHIFT_LABELS, STATUS_LABELS } from "./normalize";

export type WebhookEventType =
  | "appointment.created"
  | "appointment.confirmed"
  | "appointment.canceled";

export type AppointmentWithRelations = Appointment & {
  insurance: Pick<InsuranceOption, "id" | "name">;
  visitType: Pick<VisitTypeOption, "id" | "name">;
  kneeOption: Pick<KneeOption, "id" | "name">;
};

export function buildWebhookPayload(
  event: WebhookEventType,
  appointment: AppointmentWithRelations
) {
  return {
    event,
    timestamp: new Date().toISOString(),
    data: {
      id: appointment.id,
      protocol: appointment.protocol,
      patientName: appointment.patientName,
      whatsapp: appointment.whatsapp,
      date: formatDateISO(appointment.date),
      shift: appointment.shift,
      shiftLabel: SHIFT_LABELS[appointment.shift],
      insurance: appointment.insurance.name,
      visitType: appointment.visitType.name,
      kneeOption: appointment.kneeOption.name,
      status: appointment.status,
      statusLabel: STATUS_LABELS[appointment.status],
      confirmedAt: appointment.confirmedAt?.toISOString() ?? null,
      confirmedVia: appointment.confirmedVia ?? null,
      cancelReason: appointment.cancelReason ?? null,
      createdAt: appointment.createdAt.toISOString(),
    },
  };
}

export function signWebhookBody(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function isAllowedWebhookUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    // Sempre bloqueia endereços de metadados cloud (AWS/GCP/Azure link-local)
    if (host.startsWith("169.254.") || host === "metadata.google.internal") {
      return false;
    }

    const allowPrivate =
      process.env.ALLOW_PRIVATE_WEBHOOKS === "true" ||
      process.env.NODE_ENV !== "production";

    if (!allowPrivate) {
      if (parsed.protocol !== "https:") return false;
      if (
        host === "localhost" ||
        host === "::1" ||
        host === "0.0.0.0" ||
        host.startsWith("127.") ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

async function sendToWebhookConfig(
  config: { id: string; url: string; secret: string },
  event: string,
  payload: Record<string, unknown>
) {
  const body = JSON.stringify(payload);
  const signature = signWebhookBody(body, config.secret);

  let statusCode: number | null = null;
  let responseBody = "";
  let success = false;

  if (!isAllowedWebhookUrl(config.url)) {
    return prisma.webhookLog.create({
      data: {
        webhookId: config.id,
        event,
        payload: payload as object,
        statusCode: null,
        responseBody: "URL bloqueada pela política de segurança (SSRF).",
        success: false,
      },
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(config.url, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-event": event,
        "x-webhook-signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);
    statusCode = res.status;
    responseBody = (await res.text()).slice(0, 2000);
    success = res.ok;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : "Erro ao enviar webhook";
    success = false;
  }

  return prisma.webhookLog.create({
    data: {
      webhookId: config.id,
      event,
      payload: payload as object,
      statusCode,
      responseBody,
      success,
    },
  });
}

/**
 * Dispara webhooks de forma assíncrona (não bloqueia a resposta HTTP principal).
 */
export function dispatchWebhookEvent(
  event: WebhookEventType,
  appointment: AppointmentWithRelations
): void {
  const payload = buildWebhookPayload(event, appointment);

  void (async () => {
    try {
      const configs = await prisma.webhookConfig.findMany({
        where: {
          active: true,
          events: { has: event },
        },
      });

      await Promise.allSettled(
        configs.map((cfg) => sendToWebhookConfig(cfg, event, payload))
      );
    } catch (err) {
      console.error("[webhooks] erro ao disparar evento", event, err);
    }
  })();
}

export async function resendWebhookLog(logId: string) {
  const existing = await prisma.webhookLog.findUnique({
    where: { id: logId },
    include: { webhook: true },
  });

  if (!existing) {
    throw new Error("Log de webhook não encontrado");
  }

  return sendToWebhookConfig(
    existing.webhook,
    existing.event,
    existing.payload as Record<string, unknown>
  );
}
