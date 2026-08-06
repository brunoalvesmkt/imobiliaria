"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings } from "@/lib/master-settings";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Section, Toggle } from "../../configuracoes-empresas/_shared";

const DEFAULT_BG_COLOR = "#fef3c7";
const DEFAULT_TEXT_COLOR = "#78350f";
const DEFAULT_BUTTON_TEXT_COLOR = "#ffffff";

const ALIGN_OPTIONS: { value: "left" | "center" | "right"; labelKey: "master.settings.announcement.align.left" | "master.settings.announcement.align.center" | "master.settings.announcement.align.right" }[] = [
  { value: "left", labelKey: "master.settings.announcement.align.left" },
  { value: "center", labelKey: "master.settings.announcement.align.center" },
  { value: "right", labelKey: "master.settings.announcement.align.right" },
];

const SHAPE_OPTIONS: { value: "rounded" | "square"; labelKey: "master.settings.announcement.shape.rounded" | "master.settings.announcement.shape.square" }[] = [
  { value: "rounded", labelKey: "master.settings.announcement.shape.rounded" },
  { value: "square", labelKey: "master.settings.announcement.shape.square" },
];

const DISMISS_MODE_OPTIONS: { value: "session" | "always"; labelKey: "master.settings.announcement.dismissMode.session" | "master.settings.announcement.dismissMode.always" }[] = [
  { value: "session", labelKey: "master.settings.announcement.dismissMode.session" },
  { value: "always", labelKey: "master.settings.announcement.dismissMode.always" },
];

const JUSTIFY_BY_ALIGN: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

/**
 * Mesma funcionalidade de Aviso já existente em Configurações para Empresas
 * (aquele aparece no painel das empresas) — esta versão configura o aviso
 * exibido no topo do próprio painel Master, com campos `masterAnnouncement*`
 * independentes (podem ter conteúdo/estado diferentes ao mesmo tempo).
 */
export default function MasterOwnSettingsAvisoPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    setText(settings.data.masterAnnouncementText ?? "");
    setLinkUrl(settings.data.masterAnnouncementLinkUrl ?? "");
    setLinkText(settings.data.masterAnnouncementLinkText ?? "");
  }, [settings.data]);

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;
  const s = settings.data;
  const textColor = s.masterAnnouncementTextColor ?? DEFAULT_TEXT_COLOR;
  const buttonTextColor = s.masterAnnouncementButtonTextColor ?? DEFAULT_BUTTON_TEXT_COLOR;
  const buttonShapeClass = s.masterAnnouncementButtonShape === "square" ? "rounded-none" : "rounded-md";

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

      <Section title={t("master.settings.announcement.title")}>
        <p className="text-xs text-ink-faint">{t("master.settings.ownAnnouncement.subtitle")}</p>

        <Toggle
          checked={s.masterAnnouncementEnabled}
          onChange={(v) => update.mutate({ masterAnnouncementEnabled: v })}
          label={t("master.settings.ownAnnouncement.enabled")}
        />

        <div className="flex flex-col gap-1.5 pt-1">
          <label htmlFor="masterAnnouncementText" className="text-sm font-medium text-ink">
            {t("master.settings.announcement.text")}
          </label>
          <textarea
            id="masterAnnouncementText"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (text !== (s.masterAnnouncementText ?? "")) update.mutate({ masterAnnouncementText: text.trim() || null });
            }}
            rows={3}
            maxLength={2000}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
          />
        </div>

        <Toggle
          checked={s.masterAnnouncementBold}
          onChange={(v) => update.mutate({ masterAnnouncementBold: v })}
          label={t("master.settings.announcement.textBold")}
        />

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-sm font-medium text-ink">{t("master.settings.announcement.align.label")}</span>
          <div className="inline-flex w-fit rounded-md border border-line p-0.5">
            {ALIGN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update.mutate({ masterAnnouncementAlign: opt.value })}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  s.masterAnnouncementAlign === opt.value ? "bg-brand-500 text-white" : "text-ink-dim hover:bg-surface-alt"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-sm font-medium text-ink">{t("master.settings.announcement.dismissMode.label")}</span>
          <p className="text-xs text-ink-faint">{t("master.settings.announcement.dismissMode.subtitle")}</p>
          <div className="inline-flex w-fit rounded-md border border-line p-0.5">
            {DISMISS_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update.mutate({ masterAnnouncementDismissMode: opt.value })}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  s.masterAnnouncementDismissMode === opt.value ? "bg-brand-500 text-white" : "text-ink-dim hover:bg-surface-alt"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <Field
          label={t("master.settings.announcement.linkUrl")}
          name="masterAnnouncementLinkUrl"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onBlur={() => {
            if (linkUrl !== (s.masterAnnouncementLinkUrl ?? "")) update.mutate({ masterAnnouncementLinkUrl: linkUrl.trim() || null });
          }}
          maxLength={2000}
          placeholder="https://..."
        />

        <Field
          label={t("master.settings.announcement.linkText")}
          name="masterAnnouncementLinkText"
          value={linkText}
          onChange={(e) => setLinkText(e.target.value)}
          onBlur={() => {
            if (linkText !== (s.masterAnnouncementLinkText ?? "")) update.mutate({ masterAnnouncementLinkText: linkText.trim() || null });
          }}
          maxLength={60}
        />

        <Toggle
          checked={s.masterAnnouncementButtonBold}
          onChange={(v) => update.mutate({ masterAnnouncementButtonBold: v })}
          label={t("master.settings.announcement.buttonBold")}
        />

        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-sm font-medium text-ink">{t("master.settings.announcement.shape.label")}</span>
          <div className="inline-flex w-fit rounded-md border border-line p-0.5">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update.mutate({ masterAnnouncementButtonShape: opt.value })}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  s.masterAnnouncementButtonShape === opt.value ? "bg-brand-500 text-white" : "text-ink-dim hover:bg-surface-alt"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="masterAnnouncementBgColor" className="text-sm font-medium text-ink">
              {t("master.settings.announcement.bgColor")}
            </label>
            <input
              id="masterAnnouncementBgColor"
              type="color"
              value={s.masterAnnouncementBgColor ?? DEFAULT_BG_COLOR}
              onChange={(e) => update.mutate({ masterAnnouncementBgColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-line bg-surface"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="masterAnnouncementTextColor" className="text-sm font-medium text-ink">
              {t("master.settings.announcement.textColor")}
            </label>
            <input
              id="masterAnnouncementTextColor"
              type="color"
              value={textColor}
              onChange={(e) => update.mutate({ masterAnnouncementTextColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-line bg-surface"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="masterAnnouncementButtonColor" className="text-sm font-medium text-ink">
              {t("master.settings.announcement.buttonColor")}
            </label>
            <input
              id="masterAnnouncementButtonColor"
              type="color"
              value={s.masterAnnouncementButtonColor ?? textColor}
              onChange={(e) => update.mutate({ masterAnnouncementButtonColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-line bg-surface"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="masterAnnouncementButtonTextColor" className="text-sm font-medium text-ink">
              {t("master.settings.announcement.buttonTextColor")}
            </label>
            <input
              id="masterAnnouncementButtonTextColor"
              type="color"
              value={buttonTextColor}
              onChange={(e) => update.mutate({ masterAnnouncementButtonTextColor: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-line bg-surface"
            />
          </div>
        </div>

        {s.masterAnnouncementEnabled && text.trim() && (
          <div className="pt-2">
            <p className="mb-1.5 text-xs text-ink-faint">{t("master.settings.announcement.preview")}</p>
            <div
              className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-4 py-2.5 text-sm ${JUSTIFY_BY_ALIGN[s.masterAnnouncementAlign] ?? "justify-start"}`}
              style={{
                backgroundColor: s.masterAnnouncementBgColor ?? DEFAULT_BG_COLOR,
                color: textColor,
              }}
            >
              <span className={s.masterAnnouncementBold ? "font-bold" : undefined}>{text}</span>
              {linkUrl.trim() && (
                <span
                  className={`px-3 py-1 ${buttonShapeClass} ${s.masterAnnouncementButtonBold ? "font-bold" : "font-semibold"}`}
                  style={{ backgroundColor: s.masterAnnouncementButtonColor ?? textColor, color: buttonTextColor }}
                >
                  {linkText.trim() || linkUrl.trim()}
                </span>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
