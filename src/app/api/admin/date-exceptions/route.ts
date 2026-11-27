import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { dateExceptionUpsertSchema } from "@/lib/validations";
import { formatDateISO, parseDateOnly } from "@/lib/normalize";

export const dynamic = "force-dynamic";

function serializeException(ex: {
  id: string;
  date: Date;
  shift: string;
  maxSlots: number;
  privateReserveSlots: number;
  isBlocked: boolean;
  reason: string | null;
  locationId: string | null;
  location: { id: string; name: string; address: string | null } | null;
  allowedInsurances: Array<{ id: string; name: string }>;
}) {
  return {
    id: ex.id,
    date: formatDateISO(ex.date),
    shift: ex.shift,
    maxSlots: ex.maxSlots,
    privateReserveSlots: ex.privateReserveSlots,
    isBlocked: ex.isBlocked,
    reason: ex.reason,
    locationId: ex.locationId,
    location: ex.location,
    allowedInsuranceIds: ex.allowedInsurances.map((i) => i.id),
    allowedInsurances: ex.allowedInsurances,
  };
}

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireModule("settings");
  if (errorResponse) return errorResponse;

  const sp = request.nextUrl.searchParams;
  const month = sp.get("month"); // YYYY-MM

  let where = {};
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    where = { date: { gte: start, lte: end } };
  }

  const exceptions = await prisma.dateException.findMany({
    where,
    include: {
      location: { select: { id: true, name: true, address: true } },
      allowedInsurances: {
        select: { id: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ date: "asc" }, { shift: "asc" }],
  });

  return NextResponse.json({
    exceptions: exceptions.map(serializeException),
  });
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireModule("settings");
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const parsed = dateExceptionUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const dateObj = parseDateOnly(parsed.data.date);

  await prisma.$transaction(async (tx) => {
    // Limpa exceções anteriores desta data para substituir integralmente
    await tx.dateException.deleteMany({ where: { date: dateObj } });

    if (parsed.data.isBlocked) {
      await tx.dateException.create({
        data: {
          date: dateObj,
          shift: "FULL_DAY",
          maxSlots: 0,
          privateReserveSlots: 0,
          isBlocked: true,
          reason: parsed.data.reason || "Data bloqueada",
        },
      });
    } else if (parsed.data.shifts && parsed.data.shifts.length > 0) {
      for (const s of parsed.data.shifts) {
        const insuranceIds = Array.from(new Set(s.allowedInsuranceIds ?? []));
        await tx.dateException.create({
          data: {
            date: dateObj,
            shift: s.shift,
            maxSlots: s.maxSlots,
            privateReserveSlots: Math.min(s.privateReserveSlots, s.maxSlots),
            isBlocked: false,
            reason: parsed.data.reason || "Configuração personalizada",
            locationId: s.locationId || null,
            allowedInsurances:
              insuranceIds.length > 0
                ? { connect: insuranceIds.map((id) => ({ id })) }
                : undefined,
          },
        });
      }
    }
  });

  const saved = await prisma.dateException.findMany({
    where: { date: dateObj },
    include: {
      location: { select: { id: true, name: true, address: true } },
      allowedInsurances: {
        select: { id: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: { shift: "asc" },
  });

  return NextResponse.json({
    ok: true,
    exceptions: saved.map(serializeException),
  });
}

export async function DELETE(request: NextRequest) {
  const { errorResponse } = await requireModule("settings");
  if (errorResponse) return errorResponse;

  const dateStr = request.nextUrl.searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Informe ?date=YYYY-MM-DD" }, { status: 400 });
  }

  await prisma.dateException.deleteMany({
    where: { date: parseDateOnly(dateStr) },
  });

  return NextResponse.json({ ok: true, restoredToWeekly: true });
}
