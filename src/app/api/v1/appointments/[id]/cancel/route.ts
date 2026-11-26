import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyRequest } from "@/lib/auth";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import {
  formatDateBR,
  formatDateISO,
  SHIFT_LABELS,
  STATUS_LABELS,
} from "@/lib/normalize";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const apiKey = await verifyApiKeyRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API Key inválida ou ausente" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.appointment.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  let reason: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.reason === "string") {
      reason = body.reason.trim().slice(0, 300);
    }
  } catch {
    // body opcional
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      cancelReason: reason || "Cancelado via API (WhatsApp)",
    },
    include: {
      insurance: { select: { id: true, name: true } },
      visitType: { select: { id: true, name: true } },
      kneeOption: { select: { id: true, name: true } },
    },
  });

  dispatchWebhookEvent("appointment.canceled", updated);

  const dateISO = formatDateISO(updated.date);
  return NextResponse.json({
    ok: true,
    slotReleased: true,
    appointment: {
      id: updated.id,
      protocol: updated.protocol,
      patientName: updated.patientName,
      whatsapp: updated.whatsapp,
      date: dateISO,
      dateBR: formatDateBR(dateISO),
      shift: updated.shift,
      shiftLabel: SHIFT_LABELS[updated.shift],
      insurance: updated.insurance.name,
      visitType: updated.visitType.name,
      kneeOption: updated.kneeOption.name,
      status: updated.status,
      statusLabel: STATUS_LABELS[updated.status],
      cancelReason: updated.cancelReason,
    },
  });
}
