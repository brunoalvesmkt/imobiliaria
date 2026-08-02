"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTenantProfile, useUpdateTenantProfile, type UpdateTenantProfileInput } from "@/lib/tenant-profile";
import { usePublicSegments } from "@/lib/public-catalog";
import { useRequestEmailChange } from "@/lib/email-confirmation";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

/** Meus Dados — menu do avatar (documento de alterações, item 7). Mesmo registro principal da contratação, nunca um cadastro separado. */
export default function MeusDadosPage() {
  const { t } = useI18n();
  const profile = useTenantProfile();
  const segments = usePublicSegments();
  const update = useUpdateTenantProfile();

  const [form, setForm] = useState<UpdateTenantProfileInput | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile.data && !form) {
      const p = profile.data;
      setForm({
        razaoSocial: p.razaoSocial,
        responsavel: p.responsavel,
        telefone: p.telefone ?? "",
        whatsapp: p.whatsapp ?? "",
        segmentoId: p.segmentoId ?? "",
        endereco: p.endereco ?? "",
        numero: p.numero ?? "",
        bairro: p.bairro ?? "",
        cidade: p.cidade ?? "",
        uf: p.uf ?? "",
        cep: p.cep ?? "",
      });
    }
  }, [profile.data, form]);

  function set<K extends keyof UpdateTenantProfileInput>(key: K, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    if (!form) return;
    try {
      await update.mutateAsync(form);
      setSuccess(true);
    } catch {
      // erro exibido via update.error
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 404)) return error.message;
    return t("meusDados.errorGeneric");
  }

  if (profile.isLoading || !form) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!profile.data) return null;

  const p = profile.data;
  const readOnly = !p.canEdit;
  const subscription = p.subscriptions[0];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-lg font-semibold text-ink">{t("meusDados.title")}</h1>

      {readOnly && <Alert tone="info">{t("meusDados.readOnlyNotice")}</Alert>}
      {success && <Alert tone="success">{t("meusDados.success")}</Alert>}
      {update.error && <Alert tone="error">{errorMessage(update.error)}</Alert>}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <Field label={t("auth.signup.razaoSocial")} name="razaoSocial" required disabled={readOnly} value={form.razaoSocial ?? ""} onChange={(e) => set("razaoSocial", e.target.value)} />
        <Field label={t("auth.signup.cnpj")} name="cnpj" disabled value={p.cnpj} />
        <Field label={t("auth.signup.responsavel")} name="responsavel" required disabled={readOnly} value={form.responsavel ?? ""} onChange={(e) => set("responsavel", e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("auth.signup.telefone")} name="telefone" disabled={readOnly} value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
          <Field label={t("auth.signup.whatsapp")} name="whatsapp" disabled={readOnly} value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="segmentoId" className="text-sm font-medium text-ink">
            {t("auth.signup.segmento")}
          </label>
          <select
            id="segmentoId"
            disabled={readOnly}
            value={form.segmentoId ?? ""}
            onChange={(e) => set("segmentoId", e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink disabled:bg-surface-muted"
          >
            {segments.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>

        <Field label={t("auth.signup.endereco")} name="endereco" disabled={readOnly} value={form.endereco ?? ""} onChange={(e) => set("endereco", e.target.value)} />
        <div className="grid grid-cols-[1fr_2fr] gap-4">
          <Field label={t("auth.signup.numero")} name="numero" disabled={readOnly} value={form.numero ?? ""} onChange={(e) => set("numero", e.target.value)} />
          <Field label={t("auth.signup.bairro")} name="bairro" disabled={readOnly} value={form.bairro ?? ""} onChange={(e) => set("bairro", e.target.value)} />
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
          <Field label={t("auth.signup.cidade")} name="cidade" disabled={readOnly} value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
          <Field label={t("auth.signup.uf")} name="uf" maxLength={2} disabled={readOnly} value={form.uf ?? ""} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
          <Field label={t("auth.signup.cep")} name="cep" disabled={readOnly} value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} />
        </div>

        {!readOnly && (
          <Button type="submit" loading={update.isPending} className="w-fit">
            {t("meusDados.save")}
          </Button>
        )}
      </form>

      <EmailSection currentEmail={p.email} />

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("meusDados.subscriptionTitle")}</h2>
        {subscription ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-ink-dim">{t("meusDados.plan")}</dt>
            <dd className="text-ink">{subscription.plan?.nome ?? "—"}</dd>
            <dt className="text-ink-dim">{t("meusDados.periodicity")}</dt>
            <dd className="text-ink">
              {subscription.recorrenciaContratada
                ? t(`meusDados.periodicity.${subscription.recorrenciaContratada}` as DictionaryKey)
                : "—"}
            </dd>
            <dt className="text-ink-dim">{t("meusDados.status")}</dt>
            <dd className="text-ink">{t(`dashboard.financeiro.status.${subscription.status}` as DictionaryKey)}</dd>
          </dl>
        ) : (
          <p className="text-sm text-ink-faint">{t("meusDados.noSubscription")}</p>
        )}
      </section>
    </div>
  );
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const { t } = useI18n();
  const requestChange = useRequestEmailChange();
  const [editing, setEditing] = useState(false);
  const [novoEmail, setNovoEmail] = useState("");
  const [confirmarNovoEmail, setConfirmarNovoEmail] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    if (novoEmail !== confirmarNovoEmail) {
      setClientError(t("meusDados.email.mismatch"));
      return;
    }
    try {
      const result = await requestChange.mutateAsync(novoEmail);
      setSent(true);
      setEditing(false);
      void result;
    } catch {
      // erro exibido via requestChange.error
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">{t("meusDados.email.title")}</h2>
      <p className="text-sm text-ink">{currentEmail}</p>

      {sent && <p className="mt-2 text-sm text-brand-600 dark:text-brand-300">{t("meusDados.email.pending")}</p>}

      {!editing ? (
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setEditing(true)}>
          {t("meusDados.email.change")}
        </Button>
      ) : (
        <form className="mt-3 flex flex-col gap-3" onSubmit={onSubmit}>
          {clientError && <Alert tone="error">{clientError}</Alert>}
          {requestChange.error && <Alert tone="error">{t("meusDados.errorGeneric")}</Alert>}
          <Field
            label={t("meusDados.email.new")}
            type="email"
            name="novoEmail"
            required
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
          />
          <Field
            label={t("meusDados.email.confirmNew")}
            type="email"
            name="confirmarNovoEmail"
            onPaste={(e) => e.preventDefault()}
            required
            value={confirmarNovoEmail}
            onChange={(e) => setConfirmarNovoEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={requestChange.isPending}>
              {t("meusDados.email.submit")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              {t("meusDados.email.cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
