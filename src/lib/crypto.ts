import crypto from "node:crypto";

const ENC_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const raw =
    process.env.WEBHOOK_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "ortopedia-agendamento-jwt-secret-local-change-in-production-2026";
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Criptografa segredos sensíveis em repouso (AES-256-GCM).
 */
export function encryptSecret(plaintext: string): string {
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Descriptografa segredos em repouso (compatível com registros legados em texto puro).
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de segredo criptografado inválido");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function maskSecretValue(storedOrPlain: string): string {
  try {
    const plain = decryptSecret(storedOrPlain);
    if (plain.length <= 4) return "••••";
    return `••••••${plain.slice(-4)}`;
  } catch {
    return "••••••••";
  }
}
