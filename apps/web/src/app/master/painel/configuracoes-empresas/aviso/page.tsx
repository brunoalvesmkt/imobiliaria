"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings } from "@/lib/master-settings";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Section, Toggle } from "../_shared";

const DEFAULT_BG_COLOR = "#fef3c7";
const DEFAULT_TEXT_COLOR = "#78350f";

export default function MasterSettingsAvisoPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    setText(settings.data.announcementText ?? "");
    setLinkUrl(settings.data.announcementLinkUrl ?? "");
    setLinkText(settings.data.announcementLinkText ?? "");
  }, [settings.data]);

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;
  const s = settings.data;

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

      <Section title={t("master.settings.announcement.title")}>
        <p className="text-xs text-ink-faint">{t("master.settings.announcement.subtitle")}</p>

        <Toggle
          checked={s.announcementEnabled}
          onChange={(v) => update.mutate({ announcementEnabled: v })}
          label={t("master.settings.announcement.enabled")}
        />

        <div className="flex flex-col gap-1.5 pt-1">
          <label htmlFor="announcementText" className="text-sm font-medium text-ink">
            {t("master.settings.announcement.text")}
          </label>
          <textarea
            id="announcementText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (text !== (s.announcementText ?? "")) update.mutate({ announcementText: text.trim() || null });
            }}
            rows={3}
            maxLength={2000}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
          />
        </div>

        <Field
          label={t("master.settings.announcement.linkUrl")}
          name="announcementLinkUrl"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onBlur={() => {
            if (linkUrl !== (s.announcementLinkUrl ?? "")) update.mutate({ announcementLinkUrl: linkUrl.trim() || null });
          }}
          maxLength={2000}
          placeholder="https://..."
        />

        <Field
          label={t("master.settings.announcement.linkText")}
          name="announcementLinkText"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          onBlur={() => {
            if (linkText !== (s.announcementLinkText ?? "")) update.mutate({ announcementLinkText: linkText.trim() || null });
          }}
          maxLength={60}
        />

        <div className="flex flex-wrap gap-6 pt-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="announcementBgColor" className="text-sm font-medium text-ink">
              {t("master.settings.announcement.bgColor")}
            </label>
            <input
              id="announcementBgColor"
              type="color"
              value={s.announcementBgColor ?? DEFAULT_BG_COLOR}
              onChange={(e) => update.mutate({ announcementBgColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-line bg-surface"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="announcementTextColor" className="text-sm font-medium text-ink">
              {t("master.settings.announcement.textColor")}
            </label>
            <input
              id="announcementTextColor"
              type="color"
              value={s.announcementTextColor ?? DEFAULT_TEXT_COLOR}
              onChange={(e) => update.mutate({ announcementTextColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-line bg-surface"
            />
          </div>
        </div>

        {s.announcementEnabled && text.trim() && (
          <div className="pt-2">
            <p className="mb-1.5 text-xs text-ink-faint">{t("master.settings.announcement.preview")}</p>
            <div
              className="flex flex-wrap items-center gap-2 rounded-md px-4 py-2.5 text-sm"
              style={{
                backgroundColor: s.announcementBgColor ?? DEFAULT_BG_COLOR,
                color: s.announcementTextColor ?? DEFAULT_TEXT_COLOR,
              }}
            >
              <span>{text}</span>
              {linkUrl.trim() && (
                <span className="font-semibold underline underline-offset-2">{linkText.trim() || linkUrl.trim()}</span>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
