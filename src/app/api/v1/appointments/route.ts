import { NextResponse, type NextRequest } from "next/server";
import type { AppointmentStatus, Prisma, Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyRequest } from "@/lib/auth";
import { apiCreateAppointmentSchema } from "@/lib/validations";
import { bookAppointmentWithPriority } from "@/lib/booking-queue";
import {
  formatDateBR,
  formatDateISO,
  normalizePatientName,
  normalizeWhatsappE164,
  parseDateOnly,
  SHIFT_LABELS,
  STATUS_LABELS,
} from "@/lib/normalize";

export const dynamic = "force-dynamic";

function serializeV1Appointment(apt: {
  id: string;
  protocol: string;
  patientName: string;
  whatsapp: string;
  date: Date;
  shift: Shift;
  status: AppointmentStatus;
  confirmedAt: Date | null;
  confirmedVia: string | null;
  checkedInAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  insurance: { id: string; name: string };
  visitType: { id: string; name: string };
  kneeOption: { id: string; name: string };
}) {
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
    insuranceId: apt.insurance.id,
    visitType: apt.visitType.name,
    visitTypeId: apt.visitType.id,
    kneeOption: apt.kneeOption.name,
    kneeOptionId: apt.kneeOption.id,
    status: apt.status,
    statusLabel: STATUS_LABELS[apt.status],
    confirmedAt: apt.confirmedAt?.toISOString() ?? null,
    confirmedVia: apt.confirmedVia,
    checkedInAt: apt.checkedInAt?.toISOString() ?? null,
    cancelReason: apt.cancelReason,
    createdAt: apt.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const apiKey = await verifyApiKeyRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API Key inválida ou ausente" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const date = sp.get("date");
  const shift = sp.get("shift") as Shift | null;
  const status = sp.get("status") as AppointmentStatus | null;
  const whatsapp = sp.get("whatsapp");
  const patientName = sp.get("patientName");

  const where: Prisma.AppointmentWhereInput = {};

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where.date = parseDateOnly(date);
  }
  if (shift && ["MORNING", "AFTERNOON", "FULL_DAY"].includes(shift)) {
    where.shift = shift;
  }
  if (
    status &&
    ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELED", "NO_SHOW"].includes(
      status
    )
  ) {
    where.status = status;
  }
  if (whatsapp) {
    const normalized = normalizeWhatsappE164(whatsapp) || whatsapp.replace(/\D/g, "");
    where.whatsapp = { contains: normalized };
  }
  if (patientName) {
    where.patientNameNormalized = { contains: normalizePatientName(patientName) };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      insurance: { select: { id: true, name: true } },
      visitType: { select: { id: true, name: true } },
      kneeOption: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 200,
  });

  return NextResponse.json({
    count: appointments.length,
    appointments: appointments.map(serializeV1Appointment),
  });
}

export async function POST(request: NextRequest) {
  const apiKey = await verifyApiKeyRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API Key inválida ou ausente" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = apiCreateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors[0]?.message || "Dados inválidos",
          issues: parsed.error.errors,
        },
        { status: 400 }
      );
    }

    const result = await bookAppointmentWithPriority(parsed.data);

    if (result.outcome === "CREATED") {
      return NextResponse.json(
        {
          duplicate: false,
          appointment: serializeV1Appointment(result.appointment),
        },
        { status: 201 }
      );
    }

    if (result.outcome === "DUPLICATE") {
      return NextResponse.json(
        {
          duplicate: true,
          message: result.message,
          appointment: serializeV1Appointment(result.appointment),
        },
        { status: 200 }
      );
    }

    if (result.outcome === "FULL") {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (err) {
    console.error("[v1/appointments POST]", err);
    return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
  }
}
