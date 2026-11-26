import { NextResponse, type NextRequest } from "next/server";
import type { AppointmentStatus, Prisma, Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { resolveDayQuotas } from "@/lib/availability";
import {
  formatDateBR,
  formatDateISO,
  formatWhatsappDisplay,
  getTodayISO,
  isValidDateString,
  normalizePatientName,
  parseDateOnly,
  SHIFT_LABELS,
  STATUS_LABELS,
} from "@/lib/normalize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const dateStr = sp.get("date") || getTodayISO();
  if (!isValidDateString(dateStr)) {
    return NextResponse.json(
      { error: "Data inválida. Use o formato YYYY-MM-DD." },
      { status: 400 }
    );
  }
  const shift = sp.get("shift") as Shift | null;
  const insuranceId = sp.get("insuranceId");
  const visitTypeId = sp.get("visitTypeId");
  const kneeOptionId = sp.get("kneeOptionId");
  const locationId = sp.get("locationId");
  const status = sp.get("status") as AppointmentStatus | null;
  const search = sp.get("search")?.trim();

  const dateObj = parseDateOnly(dateStr);

  const [dayQuotas, allDayAppointments] = await Promise.all([
    resolveDayQuotas(dateStr),
    prisma.appointment.findMany({
      where: { date: dateObj },
      select: { id: true, status: true, shift: true },
    }),
  ]);

  const totalSlots = dayQuotas.reduce((acc, q) => acc + q.maxSlots, 0);
  const activeBooked = allDayAppointments.filter((a) => a.status !== "CANCELED").length;
  const confirmed = allDayAppointments.filter(
    (a) => a.status === "CONFIRMED" || a.status === "CHECKED_IN" || a.status === "COMPLETED"
  ).length;
  const pending = allDayAppointments.filter((a) => a.status === "PENDING").length;
  const canceled = allDayAppointments.filter((a) => a.status === "CANCELED").length;
  const checkedIn = allDayAppointments.filter((a) => a.status === "CHECKED_IN").length;
  const completed = allDayAppointments.filter((a) => a.status === "COMPLETED").length;

  const where: Prisma.AppointmentWhereInput = { date: dateObj };
  if (shift && ["MORNING", "AFTERNOON", "FULL_DAY"].includes(shift)) {
    where.shift = shift;
  }
  if (insuranceId) where.insuranceId = insuranceId;
  if (visitTypeId) where.visitTypeId = visitTypeId;
  if (kneeOptionId) where.kneeOptionId = kneeOptionId;
  if (locationId) where.locationId = locationId;
  if (
    status &&
    ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELED", "NO_SHOW"].includes(
      status
    )
  ) {
    where.status = status;
  }
  if (search) {
    const norm = normalizePatientName(search);
    const digits = search.replace(/\D/g, "");
    where.OR = [
      { patientNameNormalized: { contains: norm } },
      { protocol: { contains: search.toUpperCase() } },
      ...(digits.length >= 3 ? [{ whatsapp: { contains: digits } }] : []),
    ];
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      insurance: { select: { id: true, name: true, isPrivatePriority: true } },
      visitType: { select: { id: true, name: true } },
      kneeOption: { select: { id: true, name: true } },
      location: { select: { id: true, name: true, address: true } },
    },
    orderBy: [{ checkedInAt: "asc" }, { createdAt: "asc" }],
  });

  const [insurances, visitTypes, kneeOptions, locations] = await Promise.all([
    prisma.insuranceOption.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.visitTypeOption.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.kneeOption.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.locationOption.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  return NextResponse.json({
    date: dateStr,
    dateBR: formatDateBR(dateStr),
    stats: {
      totalSlots,
      activeBooked,
      remainingSlots: Math.max(0, totalSlots - activeBooked),
      confirmed,
      pending,
      canceled,
      checkedIn,
      completed,
    },
    quotas: dayQuotas.map((q) => ({
      ...q,
      shiftLabel: SHIFT_LABELS[q.shift],
      booked: allDayAppointments.filter(
        (a) => a.shift === q.shift && a.status !== "CANCELED"
      ).length,
    })),
    appointments: appointments.map((apt) => ({
      id: apt.id,
      protocol: apt.protocol,
      patientName: apt.patientName,
      whatsapp: apt.whatsapp,
      whatsappDisplay: formatWhatsappDisplay(apt.whatsapp),
      date: formatDateISO(apt.date),
      dateBR: formatDateBR(formatDateISO(apt.date)),
      shift: apt.shift,
      shiftLabel: SHIFT_LABELS[apt.shift],
      insurance: apt.insurance,
      visitType: apt.visitType,
      kneeOption: apt.kneeOption,
      location: apt.location ?? null,
      status: apt.status,
      statusLabel: STATUS_LABELS[apt.status],
      confirmedAt: apt.confirmedAt?.toISOString() ?? null,
      confirmedVia: apt.confirmedVia,
      checkedInAt: apt.checkedInAt?.toISOString() ?? null,
      completedAt: apt.completedAt?.toISOString() ?? null,
      cancelReason: apt.cancelReason,
      notes: apt.notes,
      createdAt: apt.createdAt.toISOString(),
    })),
    filters: {
      insurances,
      visitTypes,
      kneeOptions,
      locations,
    },
  });
}
