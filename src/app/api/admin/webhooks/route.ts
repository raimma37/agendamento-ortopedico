import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { webhookCreateSchema, webhookUpdateSchema } from "@/lib/validations";
import { isAllowedWebhookUrl } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

function maskSecret(secret: string): string {
  if (secret.length <= 4) return "••••";
  return `••••••${secret.slice(-4)}`;
}

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
      secret: maskSecret(w.secret),
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

  if (!isAllowedWebhookUrl(parsed.data.url)) {
    return NextResponse.json(
      { error: "URL de webhook não permitida pela política de segurança (SSRF)." },
      { status: 400 }
    );
  }

  const webhook = await prisma.webhookConfig.create({
    data: parsed.data,
  });

  return NextResponse.json(
    { ok: true, webhook: { ...webhook, secret: maskSecret(webhook.secret) } },
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

  const { id, ...data } = parsed.data;
  const webhook = await prisma.webhookConfig.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ok: true, webhook });
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

  await prisma.webhookConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
