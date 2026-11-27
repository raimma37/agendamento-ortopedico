import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp } from "./rate-limit";
import {
  ADMIN_MODULES,
  hasModuleAccess,
  isSuperAdminUser,
  type AdminModule,
} from "./permissions";

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
  isSystemSuperAdmin: boolean;
  permissions: AdminModule[];
}

export async function signSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    isSystemSuperAdmin: payload.isSystemSuperAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string
): Promise<Pick<AdminSessionPayload, "userId" | "email" | "name" | "role"> | null> {
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
      name: String(payload.name || "Usuário"),
      role: String(payload.role || "USER"),
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

  // Verifica no banco se o usuário permanece ativo e lê permissões atualizadas em tempo real
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      isSystemSuperAdmin: true,
      permissions: true,
    },
  });

  if (!user || !user.active) {
    return null;
  }

  const isSuper = Boolean(user.isSystemSuperAdmin && user.role === "SUPERADMIN");
  const validPermissions = isSuper
    ? [...ADMIN_MODULES]
    : user.permissions.filter((p): p is AdminModule =>
        (ADMIN_MODULES as readonly string[]).includes(p)
      );

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isSystemSuperAdmin: isSuper,
    permissions: validPermissions,
  };
}

export async function requireAdmin(): Promise<AdminSessionPayload | null> {
  return getAdminSession();
}

export async function requireModule(moduleId: AdminModule): Promise<
  | { session: AdminSessionPayload; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }

  if (!hasModuleAccess(session, moduleId)) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Você não tem permissão para acessar este módulo." },
        { status: 403 }
      ),
    };
  }

  return { session, errorResponse: null };
}

export async function requireSuperAdmin(): Promise<
  | { session: AdminSessionPayload; errorResponse: null }
  | { session: null; errorResponse: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }

  if (!isSuperAdminUser(session)) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Acesso restrito exclusivamente ao Superadmin." },
        { status: 403 }
      ),
    };
  }

  return { session, errorResponse: null };
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
