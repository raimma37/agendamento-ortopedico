import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { createUserSchema } from "@/lib/validations";
import { ADMIN_MODULES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const { errorResponse } = await requireSuperAdmin();
  if (errorResponse) return errorResponse;

  const users = await prisma.user.findMany({
    orderBy: [{ isSystemSuperAdmin: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSystemSuperAdmin: true,
      permissions: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      permissions:
        u.isSystemSuperAdmin && u.role === "SUPERADMIN"
          ? [...ADMIN_MODULES]
          : u.permissions,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireSuperAdmin();
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const uniquePerms = Array.from(new Set(parsed.data.permissions));
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    // Usuários criados nunca podem ser SUPERADMIN (privilégio exclusivo e fixo da conta padrão)
    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        role: "USER",
        isSystemSuperAdmin: false,
        permissions: uniquePerms,
        active: parsed.data.active,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isSystemSuperAdmin: true,
        permissions: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Já existe um usuário cadastrado com este e-mail." },
        { status: 409 }
      );
    }
    console.error("[admin/users POST]", err);
    return NextResponse.json({ error: "Erro ao criar usuário." }, { status: 500 });
  }
}
