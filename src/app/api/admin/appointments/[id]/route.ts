import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { updateAppointmentActionSchema } from "@/lib/validations";
import { dispatchWebhookEvent } from "@/lib/webhooks";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = updateAppointmentActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.cancelReason !== undefined) {
    data.cancelReason = parsed.data.cancelReason;
  }

  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === "CONFIRMED") {
      data.confirmedAt = new Date();
      data.confirmedVia = parsed.data.confirmedVia || "ADMIN_PANEL";
    } else if (parsed.data.status === "CHECKED_IN") {
      data.checkedInAt = new Date();
    } else if (parsed.data.status === "COMPLETED") {
      data.completedAt = new Date();
    } else if (parsed.data.status === "CANCELED") {
      data.canceledAt = new Date();
      if (!parsed.data.cancelReason) {
        data.cancelReason = "Cancelado pela recepção";
      }
    }
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data,
    include: {
      insurance: { select: { id: true, name: true } },
      visitType: { select: { id: true, name: true } },
      kneeOption: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, address: true } },
    },
  });

  if (parsed.data.status === "CONFIRMED" && existing.status !== "CONFIRMED") {
    dispatchWebhookEvent("appointment.confirmed", updated);
  } else if (parsed.data.status === "CANCELED" && existing.status !== "CANCELED") {
    dispatchWebhookEvent("appointment.canceled", updated);
  }

  return NextResponse.json({ ok: true, appointment: updated });
}
