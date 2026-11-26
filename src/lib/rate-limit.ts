import type { NextRequest } from "next/server";

interface Bucket {
  timestamps: number[];
}

const MAX_STORE_SIZE = 10_000;

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: Map<string, Bucket>;
};

const store = globalForRateLimit.rateLimitStore ?? new Map<string, Bucket>();
if (!globalForRateLimit.rateLimitStore) {
  globalForRateLimit.rateLimitStore = store;
}

function sanitizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, 64);
  if (!trimmed || !/^[0-9a-fA-F:.]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Extrai o IP do cliente de forma resistente a spoofing de cabeçalhos.
 * Quando TRUST_PROXY=true, confia em cabeçalhos definidos pelo proxy reverso
 * (CF-Connecting-IP -> X-Real-IP -> último IP do X-Forwarded-For).
 */
export function getClientIp(request: NextRequest): string {
  const trustProxy = process.env.TRUST_PROXY === "true";

  if (trustProxy) {
    const cfIp = sanitizeIp(request.headers.get("cf-connecting-ip"));
    if (cfIp) return cfIp;

    const realIp = sanitizeIp(request.headers.get("x-real-ip"));
    if (realIp) return realIp;

    const fwd = request.headers.get("x-forwarded-for");
    if (fwd) {
      const hops = fwd
        .split(",")
        .map((s) => sanitizeIp(s))
        .filter((ip): ip is string => Boolean(ip));
      if (hops.length > 0) {
        // O último IP da cadeia é o adicionado pelo proxy mais próximo da aplicação
        return hops[hops.length - 1];
      }
    }
  } else {
    const realIp = sanitizeIp(request.headers.get("x-real-ip"));
    if (realIp) return realIp;
  }

  return "127.0.0.1";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = store.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    store.set(key, bucket);
    return { allowed: false, retryAfterSec };
  }

  bucket.timestamps.push(now);
  store.set(key, bucket);

  // Limpeza periódica com teto rígido para evitar exaustão de memória
  if (store.size > MAX_STORE_SIZE) {
    for (const [k, v] of store.entries()) {
      if (v.timestamps.length === 0 || v.timestamps[v.timestamps.length - 1] <= cutoff) {
        store.delete(k);
      }
    }
    if (store.size > MAX_STORE_SIZE) {
      const overflow = store.size - MAX_STORE_SIZE;
      let removed = 0;
      for (const k of store.keys()) {
        store.delete(k);
        if (++removed >= overflow) break;
      }
    }
  }

  return { allowed: true, retryAfterSec: 0 };
}
