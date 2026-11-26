import { z } from "zod";
import { isValidDateString, normalizeWhatsappE164 } from "./normalize";

export const shiftEnum = z.enum(["MORNING", "AFTERNOON", "FULL_DAY"]);
export const statusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
]);

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
  .refine((val) => isValidDateString(val), "Data inválida no calendário");

export const createAppointmentSchema = z.object({
  patientName: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do paciente")
    .max(150, "Nome muito longo"),
  whatsapp: z
    .string()
    .trim()
    .refine((val) => normalizeWhatsappE164(val) !== null, {
      message: "Informe um número de WhatsApp válido com DDD",
    }),
  date: dateStringSchema,
  shift: shiftEnum,
  insuranceId: z.string().min(1, "Selecione o convênio ou Particular"),
  visitTypeId: z.string().min(1, "Selecione o tipo de consulta"),
  kneeOptionId: z.string().min(1, "Selecione qual joelho será avaliado"),
  lgpdAccepted: z.boolean().refine((v) => v === true, {
    message: "É necessário aceitar a Política de Privacidade (LGPD)",
  }),
});

export const apiCreateAppointmentSchema = createAppointmentSchema.extend({
  lgpdAccepted: z.boolean().optional().default(true),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(4, "Senha inválida"),
});

export const updateAppointmentActionSchema = z.object({
  status: statusEnum.optional(),
  cancelReason: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  confirmedVia: z.string().max(50).optional(),
});

export const weeklyQuotaItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  shift: shiftEnum,
  maxSlots: z.number().int().min(0).max(200),
  privateReserveSlots: z.number().int().min(0).max(200).default(0),
  active: z.boolean(),
  locationId: z.string().max(64).nullable().optional(),
  allowedInsuranceIds: z.array(z.string().max(64)).max(100).optional().default([]),
});

export const updateWeeklyQuotasSchema = z.object({
  quotas: z.array(weeklyQuotaItemSchema).min(1).max(21),
});

export const dateExceptionUpsertSchema = z.object({
  date: dateStringSchema,
  isBlocked: z.boolean(),
  reason: z.string().max(200).optional().nullable(),
  shifts: z
    .array(
      z.object({
        shift: shiftEnum,
        maxSlots: z.number().int().min(0).max(200),
        privateReserveSlots: z.number().int().min(0).max(200).default(0),
        locationId: z.string().max(64).nullable().optional(),
        allowedInsuranceIds: z.array(z.string().max(64)).max(100).optional().default([]),
      })
    )
    .max(3)
    .optional(),
});

export const clinicSettingsUpdateSchema = z.object({
  clinicName: z.string().trim().min(2).max(160),
  bookingWindowDays: z.number().int().min(1).max(365),
  showRemainingSlots: z.boolean(),
  protocolInstructions: z.string().trim().min(5).max(1000),
});

export const formOptionCreateSchema = z.object({
  type: z.enum(["insurance", "visitType", "knee", "location"]),
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().max(250).nullable().optional(),
  isPrivatePriority: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(999).optional().default(0),
});

export const formOptionUpdateSchema = z.object({
  type: z.enum(["insurance", "visitType", "knee", "location"]),
  id: z.string().min(1),
  name: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().max(250).nullable().optional(),
  isPrivatePriority: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome para a chave").max(80),
});

export const webhookCreateSchema = z.object({
  name: z.string().trim().min(2).max(80).default("Webhook n8n"),
  url: z.string().url("Informe uma URL válida (http:// ou https://)"),
  secret: z.string().trim().min(6, "Secret deve ter no mínimo 6 caracteres").max(120),
  events: z
    .array(z.enum(["appointment.created", "appointment.confirmed", "appointment.canceled"]))
    .min(1, "Selecione pelo menos um evento")
    .max(10),
  active: z.boolean().optional().default(true),
});

export const webhookUpdateSchema = webhookCreateSchema.partial().extend({
  id: z.string().min(1),
});
