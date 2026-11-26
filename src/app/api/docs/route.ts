import { NextResponse, type NextRequest } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi";

export async function GET(request: NextRequest) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin ||
    "http://localhost:3000";
  return NextResponse.json(buildOpenApiSpec(origin));
}
