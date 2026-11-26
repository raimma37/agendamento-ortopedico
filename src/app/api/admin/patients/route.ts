import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  formatDateBR,
  formatDateISO,
  formatWhatsappDisplay,
  normalizePatientName,
  SHIFT_LABELS,
  STATUS_LABELS,
} from "@/lib/normalize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get("search")?.trim();
  const digits = search ? search.replace(/\D/g, "") : "";
  const normSearch = search ? normalizePatientName(search) : "";

  const appointments = await prisma.appointment.findMany({
    where: search
      ? {
          OR: [
            { patientNameNormalized: { contains: normSearch } },
            ...(digits.length >= 3 ? [{ whatsapp: { contains: digits } }] : []),
          ],
        }
      : undefined,
    include: {
      insurance: { select: { name: true } },
      visitType: { select: { name: true } },
      kneeOption: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const grouped = new Map<
    string,
    {
      key: string;
      patientName: string;
      whatsapp: string;
      whatsappDisplay: string;
      totalAppointments: number;
      completedCount: number;
      canceledCount: number;
      lastDateBR: string;
      history: Array<{
        id: string;
        protocol: string;
        dateBR: string;
        shiftLabel: string;
        location: string | null;
        insurance: string;
        visitType: string;
        kneeOption: string;
        status: string;
        statusLabel: string;
      }>;
    }
  >();

  for (const apt of appointments) {
    const key = apt.patientNameNormalized;
    const dateISO = formatDateISO(apt.date);
    const dateBR = formatDateBR(dateISO);

    let entry = grouped.get(key);
    if (!entry) {
      entry = {
        key,
        patientName: apt.patientName,
        whatsapp: apt.whatsapp,
        whatsappDisplay: formatWhatsappDisplay(apt.whatsapp),
        totalAppointments: 0,
        completedCount: 0,
        canceledCount: 0,
        lastDateBR: dateBR,
        history: [],
      };
      grouped.set(key, entry);
    }

    entry.totalAppointments++;
    if (apt.status === "COMPLETED") entry.completedCount++;
    if (apt.status === "CANCELED") entry.canceledCount++;
    entry.history.push({
      id: apt.id,
      protocol: apt.protocol,
      dateBR,
      shiftLabel: SHIFT_LABELS[apt.shift],
      location: apt.location?.name ?? null,
      insurance: apt.insurance.name,
      visitType: apt.visitType.name,
      kneeOption: apt.kneeOption.name,
      status: apt.status,
      statusLabel: STATUS_LABELS[apt.status],
    });
  }

  return NextResponse.json({
    patients: Array.from(grouped.values()),
  });
}
