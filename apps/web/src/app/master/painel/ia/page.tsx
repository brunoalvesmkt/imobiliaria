"use client";

import { useState } from "react";
import {
  useDeletePlatformAiKey,
  usePlatformAiKeys,
  useSavePlatformAiKey,
  type AiProviderName,
  type PlatformAiKeyStatus,
} from "@/lib/ai-settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT (OpenAI)",
  google: "Gemini (Google)",
};

export default function MasterAiPage() {
  const { t } = useI18n();
  const keys = usePlatformAiKeys();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("master.ai.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("master.ai.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-3">
        {keys.data?.map((status) => (
          <ProviderCard key={status.provider} status={status} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({ status }: { status: PlatformAiKeyStatus }) {
  const { t } = useI18n();
  const save = useSavePlatformAiKey();
  const remove = useDeletePlatformAiKey();
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ provider: status.provider, apiKey });
      setApiKey("");
      setEditing(false);
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{PROVIDER_LABELS[status.provider]}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {status.hasKey
              ? status.source === "database"
                ? t("master.ai.sourceDatabase")
                : t("master.ai.sourceEnv")
              : t("master.ai.sourceNone")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.source === "database" && (
            <button
              type="button"
              onClick={() => remove.mutate(status.provider)}
              disabled={remove.isPending}
              className="text-xs font-medium text-ink-dim hover:underline disabled:opacity-40"
            >
              {t("master.ai.remove")}
            </button>
          )}
          <Button type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? t("common.cancel") : status.hasKey ? t("master.ai.replace") : t("master.ai.configure")}
          </Button>
        </div>
      </div>

      {editing && (
        <form onSubmit={onSave} className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {save.error && <Alert tone="error">{t("master.ai.errorGeneric")}</Alert>}
          <Field
            label={t("master.ai.apiKeyLabel")}
            type="password"
            required
            minLength={8}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div>
            <Button type="submit" loading={save.isPending}>
              {t("master.ai.save")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
