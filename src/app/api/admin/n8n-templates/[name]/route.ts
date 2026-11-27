import { NextResponse, type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireModule } from "@/lib/auth";

const ALLOWED_TEMPLATES = new Set([
  "fluxo-lembrete-cron.json",
  "fluxo-resposta-whatsapp.json",
]);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  const { errorResponse } = await requireModule("integrations");
  if (errorResponse) return errorResponse;

  const { name } = await context.params;
  if (!ALLOWED_TEMPLATES.has(name)) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  const filePath = path.resolve(process.cwd(), "n8n-templates", name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
