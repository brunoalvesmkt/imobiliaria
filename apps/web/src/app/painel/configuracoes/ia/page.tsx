"use client";

import { useState } from "react";
import { useAiAccess, useDeleteAiKey, useSaveAiKey, type AiProviderAccess, type AiProviderName } from "@/lib/ai-settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT (OpenAI)",
  google: "Gemini (Google)",
};

export default function ConfiguracoesIaPage() {
  const { t } = useI18n();
  const access = useAiAccess();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("ia.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("ia.subtitle")}</p>
      </div>

      {access.isLoading && <p className="text-sm text-ink-faint">{t("common.loading")}</p>}

      {access.data && !access.data.enabled && <Alert tone="info">{t("ia.notEnabled")}</Alert>}

      {access.data?.enabled && (
        <div className="flex flex-col gap-3">
          {access.data.providers.map((provider) => (
            <ProviderCard
              key={provider.provider}
              provider={provider}
              allowByok={access.data!.allowByok}
              allowPlatformKey={access.data!.allowPlatformKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  allowByok,
  allowPlatformKey,
}: {
  provider: AiProviderAccess;
  allowByok: boolean;
  allowPlatformKey: boolean;
}) {
  const { t } = useI18n();
  const saveKey = useSaveAiKey();
  const deleteKey = useDeleteAiKey();
  const [apiKey, setApiKey] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await saveKey.mutateAsync({ provider: provider.provider, apiKey });
      setApiKey("");
      setEditing(false);
    } catch {
      setError(t("ia.errorGeneric"));
    }
  }

  async function onDelete() {
    setError(null);
    try {
      await deleteKey.mutateAsync(provider.provider);
    } catch {
      setError(t("ia.errorGeneric"));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">{PROVIDER_LABELS[provider.provider]}</h2>
          <StatusLine provider={provider} allowByok={allowByok} allowPlatformKey={allowPlatformKey} />
        </div>
        {allowByok && !editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {provider.hasOwnKey ? t("ia.changeKey") : t("ia.addKey")}
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {allowByok && editing && (
        <form onSubmit={onSave} className="flex flex-wrap items-end gap-2 rounded-md bg-surface-alt p-3">
          <Field
            label={t("ia.apiKeyLabel")}
            type="password"
            required
            minLength={8}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <Button type="submit" loading={saveKey.isPending}>
            {t("common.save")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            {t("common.cancel")}
          </Button>
        </form>
      )}

      {allowByok && provider.hasOwnKey && !editing && (
        <div>
          <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline">
            {deleteKey.isPending ? t("common.loading") : t("ia.removeKey")}
          </button>
        </div>
      )}
    </section>
  );
}

function StatusLine({
  provider,
  allowByok,
  allowPlatformKey,
}: {
  provider: AiProviderAccess;
  allowByok: boolean;
  allowPlatformKey: boolean;
}) {
  const { t } = useI18n();

  let statusKey: DictionaryKey;
  if (provider.usable && provider.hasOwnKey) {
    statusKey = "ia.status.usingOwnKey";
  } else if (provider.usable && provider.platformKeyConfigured) {
    statusKey = "ia.status.usingPlatformKey";
  } else if (!allowByok && !allowPlatformKey) {
    statusKey = "ia.status.notAllowed";
  } else {
    statusKey = "ia.status.unavailable";
  }

  return <p className="mt-0.5 text-xs text-ink-faint">{t(statusKey)}</p>;
}
