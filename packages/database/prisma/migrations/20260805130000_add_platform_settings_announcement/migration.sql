-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "announcementBgColor" TEXT,
ADD COLUMN     "announcementEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "announcementLinkText" TEXT,
ADD COLUMN     "announcementLinkUrl" TEXT,
ADD COLUMN     "announcementText" TEXT,
ADD COLUMN     "announcementTextColor" TEXT;

