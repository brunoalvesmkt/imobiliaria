"use client";

import { useState } from "react";
import { useTenantBranding } from "@/lib/branding";
import { useI18n } from "@/lib/i18n";

const JUSTIFY_BY_ALIGN: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

export function AnnouncementBanner() {
  const { t } = useI18n();
  const branding = useTenantBranding();
  const [dismissed, setDismissed] = useState(false);
  const announcement = branding.data?.announcement;

  if (!announcement?.enabled || !announcement.text || dismissed) return null;

  const textColor = announcement.textColor ?? "#78350f";
  const buttonShapeClass = announcement.buttonShape === "square" ? "rounded-none" : "rounded-md";

  return (
    <div
      className="flex flex-none items-center gap-3 px-4 py-2 text-sm sm:px-6"
      style={{ backgroundColor: announcement.bgColor ?? "#fef3c7", color: textColor }}
    >
      <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 ${JUSTIFY_BY_ALIGN[announcement.align] ?? "justify-start"}`}>
        <span className={announcement.bold ? "font-bold" : undefined}>{announcement.text}</span>
        {announcement.linkUrl && (
          <a
            href={announcement.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-3 py-1 text-white transition-opacity hover:opacity-90 ${buttonShapeClass} ${announcement.bold ? "font-bold" : "font-semibold"}`}
            style={{ backgroundColor: announcement.buttonColor ?? textColor }}
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
