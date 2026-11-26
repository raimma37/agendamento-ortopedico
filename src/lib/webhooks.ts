import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import type {
  Appointment,
  InsuranceOption,
  KneeOption,
  LocationOption,
  VisitTypeOption,
} from "@prisma/client";
import { prisma } from "./prisma";
import { formatDateISO, SHIFT_LABELS, STATUS_LABELS } from "./normalize";
import { decryptSecret } from "./crypto";

export type WebhookEventType =
  | "appointment.created"
  | "appointment.confirmed"
  | "appointment.canceled";

export type AppointmentWithRelations = Appointment & {
  insurance: Pick<InsuranceOption, "id" | "name">;
  visitType: Pick<VisitTypeOption, "id" | "name">;
  kneeOption: Pick<KneeOption, "id" | "name">;
  location?: Pick<LocationOption, "id" | "name" | "address"> | null;
};

const WEBHOOK_LOG_RETENTION_DAYS = 30;

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
      location: appointment.location?.name ?? null,
      locationAddress: appointment.location?.address ?? null,
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

/**
 * Reduz exposição de PII (LGPD) ao persistir payloads em WebhookLog.
 * O disparo HTTP continua enviando o payload completo necessário ao n8n.
 */
function redactPayloadForLog(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data;
  if (!data || typeof data !== "object") return payload;
  const copy = { ...(data as Record<string, unknown>) };
  if (typeof copy.whatsapp === "string" && copy.whatsapp.length >= 4) {
    copy.whatsapp = `***${copy.whatsapp.slice(-4)}`;
  }
  return { ...payload, data: copy };
}

export function signWebhookBody(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0) return true; // 192.0.0.0/16 reserved
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast & reserved
  return false;
}

export function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const version = net.isIP(ip);
  if (version === 4) {
    return isPrivateOrReservedIpv4(ip);
  }
  if (version === 6) {
    if (ip === "::" || ip === "::1") return true;
    // IPv4-mapped IPv6 (ex: ::ffff:127.0.0.1 ou ::ffff:7f00:1)
    if (ip.startsWith("::ffff:")) {
      const mapped = ip.slice(7);
      if (net.isIP(mapped) === 4) return isPrivateOrReservedIpv4(mapped);
      return true;
    }
    // ULA (fc00::/7), link-local (fe80::/10), multicast (ff00::/8)
    if (
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe8") ||
      ip.startsWith("fe9") ||
      ip.startsWith("fea") ||
      ip.startsWith("feb") ||
      ip.startsWith("ff")
    ) {
      return true;
    }
    return false;
  }
  return true;
}

export function isAllowedWebhookUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    // Sempre bloqueia endereços de metadados cloud (AWS/GCP/Azure link-local)
    if (
      host.startsWith("169.254.") ||
      host === "metadata.google.internal" ||
      host === "metadata" ||
      host === "fd00:ec2::254"
    ) {
      return false;
    }

    const allowPrivate =
      process.env.ALLOW_PRIVATE_WEBHOOKS === "true" ||
      process.env.NODE_ENV !== "production";

    if (!allowPrivate) {
      if (parsed.protocol !== "https:") return false;
      if (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".local") ||
        host.endsWith(".internal")
      ) {
        return false;
      }
      if (net.isIP(host) !== 0 && isPrivateOrReservedIp(host)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validação assíncrona anti-SSRF incluindo resolução DNS para impedir
 * DNS rebinding e redirecionamento para IPs privados (IPv4/IPv6).
 */
export async function assertSafeWebhookUrl(rawUrl: string): Promise<boolean> {
  if (!isAllowedWebhookUrl(rawUrl)) return false;

  const allowPrivate =
    process.env.ALLOW_PRIVATE_WEBHOOKS === "true" ||
    process.env.NODE_ENV !== "production";
  if (allowPrivate) return true;

  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (net.isIP(host) !== 0) {
      return !isPrivateOrReservedIp(host);
    }

    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records || records.length === 0) return false;
    return records.every((rec) => !isPrivateOrReservedIp(rec.address));
  } catch {
    return false;
  }
}

async function pruneOldWebhookLogs(): Promise<void> {
  const cutoff = new Date(
    Date.now() - WEBHOOK_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  await prisma.webhookLog
    .deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    .catch(() => {});
}

async function sendToWebhookConfig(
  config: { id: string; url: string; secret: string },
  event: string,
  payload: Record<string, unknown>
) {
  const body = JSON.stringify(payload);
  const plainSecret = decryptSecret(config.secret);
  const signature = signWebhookBody(body, plainSecret);
  const logPayload = redactPayloadForLog(payload);

  let statusCode: number | null = null;
  let responseBody = "";
  let success = false;

  const isSafe = await assertSafeWebhookUrl(config.url);
  if (!isSafe) {
    return prisma.webhookLog.create({
      data: {
        webhookId: config.id,
        event,
        payload: logPayload as object,
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
      payload: logPayload as object,
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

      await Promise.allSettled([
        ...configs.map((cfg) => sendToWebhookConfig(cfg, event, payload)),
        pruneOldWebhookLogs(),
      ]);
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
