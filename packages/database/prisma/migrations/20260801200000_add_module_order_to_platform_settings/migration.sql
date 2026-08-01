-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "moduleOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
