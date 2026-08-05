"use client";

import { useState } from "react";
import { useTenantBranding } from "@/lib/branding";
import { useI18n } from "@/lib/i18n";

export function AnnouncementBanner() {
  const { t } = useI18n();
  const branding = useTenantBranding();
  const [dismissed, setDismissed] = useState(false);
  const announcement = branding.data?.announcement;

  if (!announcement?.enabled || !announcement.text || dismissed) return null;

  return (
    <div
      className="flex flex-none items-center gap-3 px-4 py-2 text-sm sm:px-6"
      style={{ backgroundColor: announcement.bgColor ?? "#fef3c7", color: announcement.textColor ?? "#78350f" }}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span>{announcement.text}</span>
        {announcement.linkUrl && (
          <a
            href={announcement.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {announcement.linkText || announcement.linkUrl}
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("layout.announcement.close")}
        className="flex h-5 w-5 flex-none items-center justify-center rounded-full opacity-70 hover:opacity-100"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
