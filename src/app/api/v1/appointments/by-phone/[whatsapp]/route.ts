import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyRequest } from "@/lib/auth";
import {
  formatDateBR,
  formatDateISO,
  getTodayISO,
  normalizeWhatsappE164,
  parseDateOnly,
  SHIFT_LABELS,
  STATUS_LABELS,
} from "@/lib/normalize";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ whatsapp: string }> }
) {
  const apiKey = await verifyApiKeyRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API Key inválida ou ausente" }, { status: 401 });
  }

  const { whatsapp: rawPhone } = await context.params;
  const normalized = normalizeWhatsappE164(rawPhone) || rawPhone.replace(/\D/g, "");
  if (!normalized) {
    return NextResponse.json({ error: "Número de WhatsApp inválido" }, { status: 400 });
  }

  const today = parseDateOnly(getTodayISO());

  const appointments = await prisma.appointment.findMany({
    where: {
      whatsapp: normalized,
      date: { gte: today },
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
    },
    include: {
      insurance: { select: { id: true, name: true } },
      visitType: { select: { id: true, name: true } },
      kneeOption: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    whatsapp: normalized,
    count: appointments.length,
    appointments: appointments.map((apt) => {
      const dateISO = formatDateISO(apt.date);
      return {
        id: apt.id,
        protocol: apt.protocol,
        patientName: apt.patientName,
        whatsapp: apt.whatsapp,
        date: dateISO,
        dateBR: formatDateBR(dateISO),
        shift: apt.shift,
        shiftLabel: SHIFT_LABELS[apt.shift],
        insurance: apt.insurance.name,
        visitType: apt.visitType.name,
        kneeOption: apt.kneeOption.name,
        status: apt.status,
        statusLabel: STATUS_LABELS[apt.status],
      };
    }),
  });
}
