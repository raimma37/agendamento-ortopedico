import { NextResponse, type NextRequest } from "next/server";
import type { AppointmentStatus, Prisma, Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
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

function csvEscape(value: string): string {
  // Proteção contra CSV Formula Injection (Excel/Calc)
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const escaped = safe.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireModule("reports");
  if (errorResponse) return errorResponse;

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get("startDate") || getTodayISO();
  const endDate = sp.get("endDate") || startDate;
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return NextResponse.json(
      { error: "Informe startDate e endDate válidos no formato YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "A data final deve ser igual ou posterior à data inicial." },
      { status: 400 }
    );
  }
  const shift = sp.get("shift") as Shift | null;
  const insuranceId = sp.get("insuranceId");
  const locationId = sp.get("locationId");
  const visitTypeId = sp.get("visitTypeId");
  const kneeOptionId = sp.get("kneeOptionId");
  const status = sp.get("status") as AppointmentStatus | null;
  const search = sp.get("search")?.trim() || "";
  const idsParam = sp.get("ids")?.trim() || "";
  const hideCanceled = sp.get("hideCanceled") !== "false";
  const format = sp.get("format");

  const where: Prisma.AppointmentWhereInput = {
    date: {
      gte: parseDateOnly(startDate),
      lte: parseDateOnly(endDate),
    },
  };

  if (shift && ["MORNING", "AFTERNOON", "FULL_DAY"].includes(shift)) {
    where.shift = shift;
  }
  if (insuranceId) {
    where.insuranceId = insuranceId;
  }
  if (locationId === "NONE") {
    where.locationId = null;
  } else if (locationId) {
    where.locationId = locationId;
  }
  if (visitTypeId) {
    where.visitTypeId = visitTypeId;
  }
  if (kneeOptionId) {
    where.kneeOptionId = kneeOptionId;
  }
  if (
    status &&
    ["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELED", "NO_SHOW"].includes(
      status
    )
  ) {
    where.status = status;
  } else if (hideCanceled) {
    where.status = { not: "CANCELED" };
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
  if (idsParam) {
    const idList = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 64)
      .slice(0, 500);
    if (idList.length > 0) {
      where.id = { in: idList };
    }
  }

  const [settings, appointments, insurances, locations, visitTypes, kneeOptions] =
    await Promise.all([
      prisma.clinicSettings.findUnique({ where: { id: 1 } }),
      prisma.appointment.findMany({
        where,
        include: {
          insurance: { select: { id: true, name: true } },
          visitType: { select: { id: true, name: true } },
          kneeOption: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, address: true } },
        },
        orderBy: [{ date: "asc" }, { shift: "asc" }, { createdAt: "asc" }],
      }),
      prisma.insuranceOption.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.locationOption.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.visitTypeOption.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.kneeOption.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

  if (format === "csv") {
    const header = [
      "Ordem",
      "Data",
      "Turno",
      "Local",
      "Protocolo",
      "Nome do Paciente",
      "WhatsApp",
      "Convênio",
      "Tipo de Consulta",
      "Joelho",
      "Status",
      "Chegada",
      "Observações",
    ];

    const lines = [
      header.map(csvEscape).join(";"),
      ...appointments.map((apt, idx) => {
        const dateBR = formatDateBR(formatDateISO(apt.date));
        const chegada = apt.checkedInAt
          ? apt.checkedInAt.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        return [
          String(idx + 1),
          dateBR,
          SHIFT_LABELS[apt.shift],
          apt.location?.name || "",
          apt.protocol,
          apt.patientName,
          formatWhatsappDisplay(apt.whatsapp),
          apt.insurance.name,
          apt.visitType.name,
          apt.kneeOption.name,
          STATUS_LABELS[apt.status],
          chegada,
          apt.notes || "",
        ]
          .map(csvEscape)
          .join(";");
      }),
    ];

    const csvContent = "\uFEFF" + lines.join("\r\n");
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="relatorio-agendamentos-${startDate}${
          endDate !== startDate ? `_a_${endDate}` : ""
        }.csv"`,
      },
    });
  }

  // Estatísticas completas dos dados coletados
  const byInsurance: Record<string, number> = {};
  const byLocation: Record<string, number> = {};
  const byVisitType: Record<string, number> = {};
  const byKneeOption: Record<string, number> = {};
  const byShift: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byDateMap = new Map<string, number>();

  let confirmed = 0;
  let pending = 0;
  let checkedIn = 0;
  let completed = 0;
  let canceled = 0;
  let noShow = 0;

  for (const apt of appointments) {
    const dateISO = formatDateISO(apt.date);
    const locName = apt.location?.name || "Não especificado";
    const shiftName = SHIFT_LABELS[apt.shift];
    const statusName = STATUS_LABELS[apt.status];

    byInsurance[apt.insurance.name] = (byInsurance[apt.insurance.name] || 0) + 1;
    byLocation[locName] = (byLocation[locName] || 0) + 1;
    byVisitType[apt.visitType.name] = (byVisitType[apt.visitType.name] || 0) + 1;
    byKneeOption[apt.kneeOption.name] = (byKneeOption[apt.kneeOption.name] || 0) + 1;
    byShift[shiftName] = (byShift[shiftName] || 0) + 1;
    byStatus[statusName] = (byStatus[statusName] || 0) + 1;
    byDateMap.set(dateISO, (byDateMap.get(dateISO) || 0) + 1);

    if (
      apt.status === "CONFIRMED" ||
      apt.status === "CHECKED_IN" ||
      apt.status === "COMPLETED"
    ) {
      confirmed++;
    }
    if (apt.status === "PENDING") pending++;
    if (apt.status === "CHECKED_IN") checkedIn++;
    if (apt.status === "COMPLETED") completed++;
    if (apt.status === "CANCELED") canceled++;
    if (apt.status === "NO_SHOW") noShow++;
  }

  const total = appointments.length;
  const confirmationRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  const attendanceRate =
    total > 0 ? Math.round(((checkedIn + completed) / total) * 100) : 0;
  const cancellationRate =
    total > 0 ? Math.round(((canceled + noShow) / total) * 100) : 0;

  const byDate = Array.from(byDateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, dateBR: formatDateBR(date), count }));

  const selectedLocationLabel =
    locationId === "NONE"
      ? "Não especificado"
      : locations.find((l) => l.id === locationId)?.name || "Todos os locais";
  const selectedInsuranceLabel =
    insurances.find((i) => i.id === insuranceId)?.name || "Todos os convênios";
  const selectedVisitTypeLabel =
    visitTypes.find((v) => v.id === visitTypeId)?.name || "Todos os tipos";
  const selectedKneeLabel =
    kneeOptions.find((k) => k.id === kneeOptionId)?.name || "Todos";

  return NextResponse.json({
    clinicName:
      settings?.clinicName || "Clínica Ortopédica — Especialidade em Joelho",
    generatedAt: new Date().toISOString(),
    filters: {
      startDate,
      endDate,
      startDateBR: formatDateBR(startDate),
      endDateBR: formatDateBR(endDate),
      shift: shift || "ALL",
      shiftLabel: shift ? SHIFT_LABELS[shift] : "Todos os turnos",
      locationLabel: selectedLocationLabel,
      insuranceLabel: selectedInsuranceLabel,
      visitTypeLabel: selectedVisitTypeLabel,
      kneeOptionLabel: selectedKneeLabel,
      statusLabel: status ? STATUS_LABELS[status] : "Todos",
      search,
      hideCanceled,
    },
    summary: {
      total,
      confirmed,
      pending,
      checkedIn,
      completed,
      canceled,
      noShow,
      confirmationRate,
      attendanceRate,
      cancellationRate,
      byInsurance,
      byLocation,
      byVisitType,
      byKneeOption,
      byShift,
      byStatus,
      byDate,
    },
    insurances,
    locations,
    visitTypes,
    kneeOptions,
    rows: appointments.map((apt, idx) => {
      const dateISO = formatDateISO(apt.date);
      return {
        order: idx + 1,
        id: apt.id,
        protocol: apt.protocol,
        patientName: apt.patientName,
        whatsapp: apt.whatsapp,
        whatsappDisplay: formatWhatsappDisplay(apt.whatsapp),
        date: dateISO,
        dateBR: formatDateBR(dateISO),
        shift: apt.shift,
        shiftLabel: SHIFT_LABELS[apt.shift],
        location: apt.location?.name ?? null,
        insurance: apt.insurance.name,
        visitType: apt.visitType.name,
        kneeOption: apt.kneeOption.name,
        status: apt.status,
        statusLabel: STATUS_LABELS[apt.status],
        checkedInAt: apt.checkedInAt?.toISOString() ?? null,
        notes: apt.notes ?? "",
      };
    }),
  });
}
