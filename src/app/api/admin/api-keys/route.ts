import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNewApiKey, requireAdmin } from "@/lib/auth";
import { apiKeyCreateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = apiKeyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Nome inválido" },
      { status: 400 }
    );
  }

  const { rawKey, keyHash, prefix } = generateNewApiKey();
  const created = await prisma.apiKey.create({
    data: {
      name: parsed.data.name,
      keyHash,
      prefix,
      active: true,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, key: created, rawKey }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Informe ?id=" }, { status: 400 });
  }

  await prisma.apiKey.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
