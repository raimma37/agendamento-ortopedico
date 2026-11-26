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
  if (existing.status === "CANCELED") {
    return NextResponse.json(
      { error: "Agendamento já está cancelado e não pode ser confirmado" },
      { status: 409 }
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedVia: "WHATSAPP_API",
    },
    include: {
      insurance: { select: { id: true, name: true } },
      visitType: { select: { id: true, name: true } },
      kneeOption: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, address: true } },
    },
  });

  dispatchWebhookEvent("appointment.confirmed", updated);

  const dateISO = formatDateISO(updated.date);
  return NextResponse.json({
    ok: true,
    appointment: {
      id: updated.id,
      protocol: updated.protocol,
      patientName: updated.patientName,
      whatsapp: updated.whatsapp,
      date: dateISO,
      dateBR: formatDateBR(dateISO),
      shift: updated.shift,
      shiftLabel: SHIFT_LABELS[updated.shift],
      location: updated.location?.name ?? null,
      locationAddress: updated.location?.address ?? null,
      insurance: updated.insurance.name,
      visitType: updated.visitType.name,
      kneeOption: updated.kneeOption.name,
      status: updated.status,
      statusLabel: STATUS_LABELS[updated.status],
      confirmedAt: updated.confirmedAt?.toISOString() ?? null,
      confirmedVia: updated.confirmedVia,
    },
  });
}
