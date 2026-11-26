import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { webhookCreateSchema, webhookUpdateSchema } from "@/lib/validations";
import { assertSafeWebhookUrl } from "@/lib/webhooks";
import { encryptSecret, maskSecretValue } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [webhooks, logs] = await Promise.all([
    prisma.webhookConfig.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.webhookLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        webhook: { select: { name: true, url: true } },
      },
    }),
  ]);

  return NextResponse.json({
    webhooks: webhooks.map((w) => ({
      ...w,
      secret: maskSecretValue(w.secret),
    })),
    logs,
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = webhookCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  if (!(await assertSafeWebhookUrl(parsed.data.url))) {
    return NextResponse.json(
      { error: "URL de webhook não permitida pela política de segurança (SSRF)." },
      { status: 400 }
    );
  }

  const webhook = await prisma.webhookConfig.create({
    data: {
      ...parsed.data,
      secret: encryptSecret(parsed.data.secret),
    },
  });

  return NextResponse.json(
    { ok: true, webhook: { ...webhook, secret: maskSecretValue(webhook.secret) } },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = webhookUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Dados inválidos" },
      { status: 400 }
    );
  }

  const { id, secret, url, ...rest } = parsed.data;

  if (url !== undefined && !(await assertSafeWebhookUrl(url))) {
    return NextResponse.json(
      { error: "URL de webhook não permitida pela política de segurança (SSRF)." },
      { status: 400 }
    );
  }

  try {
    const webhook = await prisma.webhookConfig.update({
      where: { id },
      data: {
        ...rest,
        ...(url !== undefined ? { url } : {}),
        ...(secret !== undefined ? { secret: encryptSecret(secret) } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      webhook: { ...webhook, secret: maskSecretValue(webhook.secret) },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Erro ao atualizar webhook" }, { status: 500 });
  }
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

  try {
    await prisma.webhookConfig.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Webhook não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Erro ao excluir webhook" }, { status: 500 });
  }
}
