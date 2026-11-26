-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "DateException" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "WeeklyQuota" ADD COLUMN     "locationId" TEXT;

-- CreateTable
CREATE TABLE "LocationOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_DateExceptionToInsuranceOption" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DateExceptionToInsuranceOption_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InsuranceOptionToWeeklyQuota" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InsuranceOptionToWeeklyQuota_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationOption_name_key" ON "LocationOption"("name");

-- CreateIndex
CREATE INDEX "_DateExceptionToInsuranceOption_B_index" ON "_DateExceptionToInsuranceOption"("B");

-- CreateIndex
CREATE INDEX "_InsuranceOptionToWeeklyQuota_B_index" ON "_InsuranceOptionToWeeklyQuota"("B");

-- CreateIndex
CREATE INDEX "Appointment_locationId_date_idx" ON "Appointment"("locationId", "date");

-- AddForeignKey
ALTER TABLE "WeeklyQuota" ADD CONSTRAINT "WeeklyQuota_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DateException" ADD CONSTRAINT "DateException_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "LocationOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DateExceptionToInsuranceOption" ADD CONSTRAINT "_DateExceptionToInsuranceOption_A_fkey" FOREIGN KEY ("A") REFERENCES "DateException"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DateExceptionToInsuranceOption" ADD CONSTRAINT "_DateExceptionToInsuranceOption_B_fkey" FOREIGN KEY ("B") REFERENCES "InsuranceOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InsuranceOptionToWeeklyQuota" ADD CONSTRAINT "_InsuranceOptionToWeeklyQuota_A_fkey" FOREIGN KEY ("A") REFERENCES "InsuranceOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InsuranceOptionToWeeklyQuota" ADD CONSTRAINT "_InsuranceOptionToWeeklyQuota_B_fkey" FOREIGN KEY ("B") REFERENCES "WeeklyQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
