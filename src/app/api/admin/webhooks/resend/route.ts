import { NextResponse, type NextRequest } from "next/server";
import { requireModule } from "@/lib/auth";
import { resendWebhookLog } from "@/lib/webhooks";

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireModule("integrations");
  if (errorResponse) return errorResponse;

  try {
    const { logId } = await request.json();
    if (!logId || typeof logId !== "string") {
      return NextResponse.json({ error: "logId obrigatório" }, { status: 400 });
    }
    const newLog = await resendWebhookLog(logId);
    return NextResponse.json({ ok: true, log: newLog });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao reenviar webhook" },
      { status: 500 }
    );
  }
}
