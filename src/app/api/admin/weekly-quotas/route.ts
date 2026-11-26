import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { updateWeeklyQuotasSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

function serializeWeeklyQuota(q: {
  id: string;
  dayOfWeek: number;
  shift: string;
  maxSlots: number;
  privateReserveSlots: number;
  active: boolean;
  locationId: string | null;
  location: { id: string; name: string; address: string | null } | null;
  allowedInsurances: Array<{ id: string; name: string }>;
}) {
  return {
    id: q.id,
    dayOfWeek: q.dayOfWeek,
    shift: q.shift,
    maxSlots: q.maxSlots,
    privateReserveSlots: q.privateReserveSlots,
    active: q.active,
    locationId: q.locationId,
    location: q.location,
    allowedInsuranceIds: q.allowedInsurances.map((i) => i.id),
    allowedInsurances: q.allowedInsurances,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const quotas = await prisma.weeklyQuota.findMany({
    include: {
      location: { select: { id: true, name: true, address: true } },
      allowedInsurances: {
        select: { id: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { shift: "asc" }],
  });

  return NextResponse.json({ quotas: quotas.map(serializeWeeklyQuota) });
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
      const cleanLocationId = q.locationId || null;
      const insuranceIds = Array.from(new Set(q.allowedInsuranceIds ?? []));

      return prisma.weeklyQuota.upsert({
        where: { dayOfWeek_shift: { dayOfWeek: q.dayOfWeek, shift: q.shift } },
        update: {
          maxSlots: q.maxSlots,
          privateReserveSlots: safeReserve,
          active: q.active,
          locationId: cleanLocationId,
          allowedInsurances: {
            set: insuranceIds.map((id) => ({ id })),
          },
        },
        create: {
          dayOfWeek: q.dayOfWeek,
          shift: q.shift,
          maxSlots: q.maxSlots,
          privateReserveSlots: safeReserve,
          active: q.active,
          locationId: cleanLocationId,
          allowedInsurances: {
            connect: insuranceIds.map((id) => ({ id })),
          },
        },
      });
    })
  );

  const quotas = await prisma.weeklyQuota.findMany({
    include: {
      location: { select: { id: true, name: true, address: true } },
      allowedInsurances: {
        select: { id: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { shift: "asc" }],
  });

  return NextResponse.json({ ok: true, quotas: quotas.map(serializeWeeklyQuota) });
}
