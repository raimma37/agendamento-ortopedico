import { NextResponse, type NextRequest } from "next/server";
import type { AppointmentStatus, Prisma, Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  formatDateBR,
  formatDateISO,
  formatWhatsappDisplay,
  getTodayISO,
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
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const startDate = sp.get("startDate") || getTodayISO();
  const endDate = sp.get("endDate") || startDate;
  const shift = sp.get("shift") as Shift | null;
  const insuranceId = sp.get("insuranceId");
  const status = sp.get("status") as AppointmentStatus | null;
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

  const [settings, appointments, insurances] = await Promise.all([
    prisma.clinicSettings.findUnique({ where: { id: 1 } }),
    prisma.appointment.findMany({
      where,
      include: {
        insurance: { select: { id: true, name: true } },
        visitType: { select: { id: true, name: true } },
        kneeOption: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { shift: "asc" }, { createdAt: "asc" }],
    }),
    prisma.insuranceOption.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  if (format === "csv") {
    const header = [
      "Ordem",
      "Data",
      "Turno",
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

  // Resumos numéricos para cabeçalho do relatório
  const byInsurance: Record<string, number> = {};
  const byVisitType: Record<string, number> = {};
  let confirmed = 0;
  let pending = 0;
  let canceled = 0;

  for (const apt of appointments) {
    byInsurance[apt.insurance.name] = (byInsurance[apt.insurance.name] || 0) + 1;
    byVisitType[apt.visitType.name] = (byVisitType[apt.visitType.name] || 0) + 1;
    if (
      apt.status === "CONFIRMED" ||
      apt.status === "CHECKED_IN" ||
      apt.status === "COMPLETED"
    ) {
      confirmed++;
    } else if (apt.status === "PENDING") {
      pending++;
    } else if (apt.status === "CANCELED") {
      canceled++;
    }
  }

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
      hideCanceled,
    },
    summary: {
      total: appointments.length,
      confirmed,
      pending,
      canceled,
      byInsurance,
      byVisitType,
    },
    insurances,
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
