import type { AppointmentStatus, Shift } from "@prisma/client";

/**
 * Normaliza nome completo do paciente para prevenção de duplicidade:
 * minúsculas, sem acentos, espaços extras colapsados.
 * Ex: "  João   da Silva " -> "joao da silva"
 */
export function normalizePatientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Normaliza telefone brasileiro para E.164 sem símbolos (ex: 5591999999999).
 * Retorna null se inválido.
 */
export function normalizeWhatsappE164(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  if (!/^55\d{10,11}$/.test(digits)) {
    return null;
  }
  return digits;
}

/**
 * Formata E.164 brasileiro para exibição legível: (91) 99999-9999
 */
export function formatWhatsappDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return e164;
}

/**
 * Aplica máscara de input brasileiro enquanto o usuário digita: (91) 99999-9999
 */
export function maskBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const PROTOCOL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Gera candidato de protocolo criptograficamente aleatório (32^6 > 1 bilhão de combinações).
 * Usa alfabeto sem caracteres ambíguos (0/O/1/I).
 */
export function generateProtocolCandidate(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PROTOCOL_ALPHABET[bytes[i] % PROTOCOL_ALPHABET.length];
  }
  return `AGD-${code}`;
}

export function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Verifica se a string YYYY-MM-DD representa uma data real válida no calendário
 * (rejeita datas impossíveis como 2026-02-31).
 */
export function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = parseDateOnly(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return formatDateISO(d) === dateStr;
}

export function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateISO(d);
}

export const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
  FULL_DAY: "Dia Inteiro",
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Chegou",
  COMPLETED: "Atendido",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

export const DAY_OF_WEEK_LABELS: string[] = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
