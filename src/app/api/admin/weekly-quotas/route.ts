import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { updateWeeklyQuotasSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const quotas = await prisma.weeklyQuota.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { shift: "asc" }],
  });

  return NextResponse.json({ quotas });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateWeeklyQuotasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    parsed.data.quotas.map((q) => {
      const safeReserve = Math.min(q.privateReserveSlots, q.maxSlots);
      return prisma.weeklyQuota.upsert({
        where: { dayOfWeek_shift: { dayOfWeek: q.dayOfWeek, shift: q.shift } },
        update: {
          maxSlots: q.maxSlots,
          privateReserveSlots: safeReserve,
          active: q.active,
        },
        create: {
          dayOfWeek: q.dayOfWeek,
          shift: q.shift,
          maxSlots: q.maxSlots,
          privateReserveSlots: safeReserve,
          active: q.active,
        },
      });
    })
  );

  const quotas = await prisma.weeklyQuota.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { shift: "asc" }],
  });

  return NextResponse.json({ ok: true, quotas });
}
