import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formOptionCreateSchema, formOptionUpdateSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [insurances, visitTypes, kneeOptions, locations] = await Promise.all([
    prisma.insuranceOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.visitTypeOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.kneeOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.locationOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  return NextResponse.json({ insurances, visitTypes, kneeOptions, locations });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = formOptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { type, name, address, isPrivatePriority, active, sortOrder } = parsed.data;
    let created;
    if (type === "insurance") {
      created = await prisma.insuranceOption.create({
        data: { name, isPrivatePriority, active, sortOrder },
      });
    } else if (type === "visitType") {
      created = await prisma.visitTypeOption.create({
        data: { name, active, sortOrder },
      });
    } else if (type === "location") {
      created = await prisma.locationOption.create({
        data: { name, address: address || null, active, sortOrder },
      });
    } else {
      created = await prisma.kneeOption.create({
        data: { name, active, sortOrder },
      });
    }

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Já existe uma opção cadastrada com esse nome" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Erro ao criar opção" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = formOptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { type, id, name, address, isPrivatePriority, active, sortOrder } = parsed.data;
    let updated;
    if (type === "insurance") {
      updated = await prisma.insuranceOption.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(isPrivatePriority !== undefined ? { isPrivatePriority } : {}),
          ...(active !== undefined ? { active } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
        },
      });
    } else if (type === "visitType") {
      updated = await prisma.visitTypeOption.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(active !== undefined ? { active } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
        },
      });
    } else if (type === "location") {
      updated = await prisma.locationOption.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(address !== undefined ? { address: address || null } : {}),
          ...(active !== undefined ? { active } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
        },
      });
    } else {
      updated = await prisma.kneeOption.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(active !== undefined ? { active } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
        },
      });
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Já existe uma opção com esse nome" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Erro ao atualizar opção" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const type = sp.get("type");
  const id = sp.get("id");
  if (!type || !id) {
    return NextResponse.json({ error: "Parâmetros type e id obrigatórios" }, { status: 400 });
  }

  try {
    if (type === "insurance") {
      await prisma.insuranceOption.delete({ where: { id } });
    } else if (type === "visitType") {
      await prisma.visitTypeOption.delete({ where: { id } });
    } else if (type === "knee") {
      await prisma.kneeOption.delete({ where: { id } });
    } else if (type === "location") {
      await prisma.locationOption.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Esta opção já está vinculada a agendamentos existentes. Desative-a em vez de excluir.",
      },
      { status: 409 }
    );
  }
}
