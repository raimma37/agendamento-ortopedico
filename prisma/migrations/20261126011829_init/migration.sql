-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'FULL_DAY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clinicName" TEXT NOT NULL DEFAULT 'Clínica Ortopédica — Especialidade em Joelho',
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "showRemainingSlots" BOOLEAN NOT NULL DEFAULT true,
    "protocolInstructions" TEXT NOT NULL DEFAULT 'Atendimento por ordem de chegada dentro do turno escolhido. Chegue com 15 minutos de antecedência levando documento com foto, carteirinha do convênio (se aplicável) e exames recentes do joelho.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyQuota" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "shift" "Shift" NOT NULL,
    "maxSlots" INTEGER NOT NULL DEFAULT 10,
    "privateReserveSlots" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DateException" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "Shift" NOT NULL,
    "maxSlots" INTEGER NOT NULL DEFAULT 0,
    "privateReserveSlots" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DateException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrivatePriority" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitTypeOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitTypeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KneeOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KneeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientNameNormalized" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "Shift" NOT NULL,
    "insuranceId" TEXT NOT NULL,
    "visitTypeId" TEXT NOT NULL,
    "kneeOptionId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
    "lgpdAccepted" BOOLEAN NOT NULL DEFAULT true,
    "cancelReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedVia" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Webhook n8n',
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WeeklyQuota_dayOfWeek_active_idx" ON "WeeklyQuota"("dayOfWeek", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyQuota_dayOfWeek_shift_key" ON "WeeklyQuota"("dayOfWeek", "shift");

-- CreateIndex
CREATE INDEX "DateException_date_idx" ON "DateException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DateException_date_shift_key" ON "DateException"("date", "shift");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceOption_name_key" ON "InsuranceOption"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VisitTypeOption_name_key" ON "VisitTypeOption"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KneeOption_name_key" ON "KneeOption"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_protocol_key" ON "Appointment"("protocol");

-- CreateIndex
CREATE INDEX "Appointment_date_shift_status_idx" ON "Appointment"("date", "shift", "status");

-- CreateIndex
CREATE INDEX "Appointment_patientNameNormalized_date_status_idx" ON "Appointment"("patientNameNormalized", "date", "status");

-- CreateIndex
CREATE INDEX "Appointment_whatsapp_date_status_idx" ON "Appointment"("whatsapp", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "WebhookLog_webhookId_createdAt_idx" ON "WebhookLog"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_insuranceId_fkey" FOREIGN KEY ("insuranceId") REFERENCES "InsuranceOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_visitTypeId_fkey" FOREIGN KEY ("visitTypeId") REFERENCES "VisitTypeOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_kneeOptionId_fkey" FOREIGN KEY ("kneeOptionId") REFERENCES "KneeOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
