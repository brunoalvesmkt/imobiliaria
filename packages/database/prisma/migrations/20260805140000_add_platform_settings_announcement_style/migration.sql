ALTER TABLE "platform_settings" ADD COLUMN     "announcementAlign" TEXT NOT NULL DEFAULT 'left',
ADD COLUMN     "announcementBold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "announcementButtonColor" TEXT,
ADD COLUMN     "announcementButtonShape" TEXT NOT NULL DEFAULT 'rounded';
