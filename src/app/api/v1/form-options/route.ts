import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Retorna as opções fixas ativas do formulário.
 * NUNCA expõe a flag interna isPrivatePriority.
 */
export async function GET(request: NextRequest) {
  const apiKey = await verifyApiKeyRequest(request);
  if (!apiKey) {
    return NextResponse.json({ error: "API Key inválida ou ausente" }, { status: 401 });
  }

  const [insurances, visitTypes, kneeOptions] = await Promise.all([
    prisma.insuranceOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.visitTypeOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.kneeOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    }),
  ]);

  return NextResponse.json({
    insurances,
    visitTypes,
    kneeOptions,
  });
}
