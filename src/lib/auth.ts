import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp } from "./rate-limit";

export const SESSION_COOKIE_NAME = "agd_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 horas
const JWT_ISSUER = "agendamento-ortopedia";
const JWT_AUDIENCE = "agendamento-admin";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "JWT_SECRET ausente ou fraco em produção (mínimo 16 caracteres)."
      );
    }
    return new TextEncoder().encode(
      "ortopedia-agendamento-jwt-secret-local-change-in-production-2026"
    );
  }
  return new TextEncoder().encode(secret);
}

export interface AdminSessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function signSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string
): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (!payload.userId || !payload.email) return null;
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name || "Admin"),
      role: String(payload.role || "ADMIN"),
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;

  // Verifica no banco se o administrador permanece ativo (revogação imediata)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  });

  if (!user || !user.active || user.role !== "ADMIN") {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function requireAdmin(): Promise<AdminSessionPayload | null> {
  return getAdminSession();
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateNewApiKey(): {
  rawKey: string;
  keyHash: string;
  prefix: string;
} {
  const random = crypto.randomBytes(24).toString("hex");
  const rawKey = `agd_live_${random}`;
  const keyHash = hashApiKey(rawKey);
  const prefix = rawKey.slice(0, 14) + "...";
  return { rawKey, keyHash, prefix };
}

export async function verifyApiKeyRequest(request: NextRequest) {
  const ip = getClientIp(request);

  const headerKey = request.headers.get("x-api-key");
  const authHeader = request.headers.get("authorization");
  let rawKey = headerKey?.trim() || "";

  if (!rawKey && authHeader?.toLowerCase().startsWith("bearer ")) {
    rawKey = authHeader.slice(7).trim();
  }

  if (!rawKey) return null;

  // Limita tentativas de força bruta de API Key por IP
  const invalidCheck = checkRateLimit(`v1-ip:${ip}`, 300, 60_000);
  if (!invalidCheck.allowed) return null;

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyHash, active: true },
  });

  if (!apiKey) {
    checkRateLimit(`v1-bad:${ip}`, 20, 60_000);
    return null;
  }

  // Rate limit por API Key ativa (300 req/min)
  const keyLimit = checkRateLimit(`v1-key:${apiKey.id}`, 300, 60_000);
  if (!keyLimit.allowed) return null;

  // Atualiza lastUsedAt de forma não-bloqueante
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return apiKey;
}
