import { NextResponse, type NextRequest } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";
import { requireAdmin, verifyApiKeyRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  const apiKey = admin ? null : await verifyApiKeyRequest(request);
  if (!admin && !apiKey) {
    return NextResponse.json(
      { error: "Autenticação necessária para acessar a especificação OpenAPI" },
      { status: 401 }
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin ||
    "http://localhost:3000";
  return NextResponse.json(buildOpenApiSpec(origin));
}
