-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSystemSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "role" SET DEFAULT 'USER';
