"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
  type Notification,
} from "@/lib/notifications";

function timeAgo(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "minute");
  if (diffMin < 60) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-diffHour, "hour");
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-Math.round(diffHour / 24), "day");
}

export function NotificationBell() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const unread = useUnreadNotificationCount();
  const list = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const count = unread.data?.count ?? 0;

  function onSelect(notification: Notification) {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notifications.title")}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-ink-dim hover:bg-surface-alt"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full z-20 mt-1 w-80 max-w-[90vw] rounded-md border border-line bg-surface shadow-md">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <p className="text-sm font-medium text-ink">{t("notifications.title")}</p>
              {count > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  {t("notifications.markAllRead")}
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {list.data?.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-faint">{t("notifications.empty")}</p>}
              {list.data?.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => onSelect(notification)}
                  className="flex w-full flex-col gap-0.5 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-surface-alt"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {!notification.readAt && <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand-600" aria-hidden="true" />}
                    {notification.titulo}
                  </span>
                  <span className="text-xs text-ink-dim">{notification.corpo}</span>
                  <span className="text-[11px] text-ink-faint">{timeAgo(notification.createdAt, locale)}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
