import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { dateExceptionUpsertSchema } from "@/lib/validations";
import { formatDateISO, parseDateOnly } from "@/lib/normalize";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

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
    orderBy: [{ date: "asc" }, { shift: "asc" }],
  });

  return NextResponse.json({
    exceptions: exceptions.map((ex) => ({
      ...ex,
      date: formatDateISO(ex.date),
    })),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

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
        await tx.dateException.create({
          data: {
            date: dateObj,
            shift: s.shift,
            maxSlots: s.maxSlots,
            privateReserveSlots: Math.min(s.privateReserveSlots, s.maxSlots),
            isBlocked: false,
            reason: parsed.data.reason || "Configuração personalizada",
          },
        });
      }
    }
  });

  const saved = await prisma.dateException.findMany({
    where: { date: dateObj },
    orderBy: { shift: "asc" },
  });

  return NextResponse.json({
    ok: true,
    exceptions: saved.map((e) => ({ ...e, date: formatDateISO(e.date) })),
  });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const dateStr = request.nextUrl.searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Informe ?date=YYYY-MM-DD" }, { status: 400 });
  }

  await prisma.dateException.deleteMany({
    where: { date: parseDateOnly(dateStr) },
  });

  return NextResponse.json({ ok: true, restoredToWeekly: true });
}
