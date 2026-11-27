import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/auth";
import { clinicSettingsUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await requireModule("settings");
  if (errorResponse) return errorResponse;

  const settings = await prisma.clinicSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const { errorResponse } = await requireModule("settings");
  if (errorResponse) return errorResponse;

  const body = await request.json();
  const parsed = clinicSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const settings = await prisma.clinicSettings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });

  return NextResponse.json({ ok: true, settings });
}
