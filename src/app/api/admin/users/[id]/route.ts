import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  requireSuperAdmin,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  signSessionToken,
} from "@/lib/auth";
import { updateSuperAdminSchema, updateUserSchema } from "@/lib/validations";
import { ADMIN_MODULES } from "@/lib/permissions";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = await requireSuperAdmin();
  if (errorResponse || !session) return errorResponse!;

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });

  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  try {
    const body = await request.json();

    // REGRA FIXA: Conta Superadmin padrão só pode alterar e-mail e senha.
    if (target.isSystemSuperAdmin || target.role === "SUPERADMIN") {
      const parsed = updateSuperAdminSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error:
              parsed.error.errors[0]?.message ||
              "Na conta Superadmin padrão, apenas e-mail e senha podem ser alterados.",
          },
          { status: 400 }
        );
      }

      const data: { email?: string; passwordHash?: string } = {};
      if (parsed.data.email) {
        data.email = parsed.data.email.toLowerCase().trim();
      }
      if (parsed.data.password && parsed.data.password.length >= 6) {
        data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json(
          { error: "Informe um novo e-mail ou uma nova senha." },
          { status: 400 }
        );
      }

      const updated = await prisma.user.update({
        where: { id: target.id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSystemSuperAdmin: true,
          permissions: true,
          active: true,
          updatedAt: true,
        },
      });

      const res = NextResponse.json({
        ok: true,
        user: { ...updated, permissions: [...ADMIN_MODULES] },
      });

      // Atualiza o cookie da sessão caso o próprio Superadmin tenha alterado o e-mail
      if (session.userId === updated.id) {
        const token = await signSessionToken({
          userId: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          isSystemSuperAdmin: true,
          permissions: [...ADMIN_MODULES],
        });
        res.cookies.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: SESSION_TTL_SECONDS,
        });
      }

      return res;
    }

    // Usuários comuns adicionados: podem alterar nome, e-mail, senha, permissões e ativo/inativo
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const data: {
      name?: string;
      email?: string;
      passwordHash?: string;
      permissions?: string[];
      active?: boolean;
    } = {};

    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.email !== undefined) {
      data.email = parsed.data.email.toLowerCase().trim();
    }
    if (parsed.data.password && parsed.data.password.length >= 6) {
      data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }
    if (parsed.data.permissions !== undefined) {
      data.permissions = Array.from(new Set(parsed.data.permissions));
    }
    if (parsed.data.active !== undefined) data.active = parsed.data.active;

    const updated = await prisma.user.update({
      where: { id: target.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isSystemSuperAdmin: true,
        permissions: true,
        active: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Já existe outro usuário cadastrado com este e-mail." },
        { status: 409 }
      );
    }
    console.error("[admin/users PATCH]", err);
    return NextResponse.json({ error: "Erro ao atualizar usuário." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireSuperAdmin();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });

  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // REGRA FIXA E IRREVOGÁVEL: Superadmin padrão nunca pode ser apagado
  if (target.isSystemSuperAdmin || target.role === "SUPERADMIN") {
    return NextResponse.json(
      { error: "A conta Superadmin padrão é protegida e nunca pode ser apagada." },
      { status: 403 }
    );
  }

  await prisma.user.delete({ where: { id: target.id } });
  return NextResponse.json({ ok: true, deletedId: target.id });
}
