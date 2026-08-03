"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useContact,
  useUpdateContact,
  useAnonymizeContact,
  useBlockContact,
  useUnblockContact,
  useMergeContacts,
  useCustomFieldDefinitions,
} from "@/lib/crm";
import { LeadScoreBadge } from "@/components/crm/lead-score-badge";
import { apiUrl } from "@/lib/api-client";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ContactTasks } from "@/components/crm/contact-tasks";
import { useI18n } from "@/lib/i18n";

export default function ContactDetailPage() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const contact = useContact(params.id);
  const updateContact = useUpdateContact(params.id);
  const anonymizeContact = useAnonymizeContact(params.id);
  const blockContact = useBlockContact(params.id);
  const unblockContact = useUnblockContact(params.id);
  const mergeContacts = useMergeContacts(params.id);
  const customFieldDefinitions = useCustomFieldDefinitions();
  const [editing, setEditing] = useState(false);
  const [confirmingAnonymize, setConfirmingAnonymize] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [mergeDuplicateId, setMergeDuplicateId] = useState("");
  const [showMergeForm, setShowMergeForm] = useState(false);
  const [form, setForm] = useState({ nome: "", sobrenome: "", telefone: "", whatsapp: "", email: "", observacoes: "" });

  if (contact.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  if (contact.isError || !contact.data) return <Alert tone="error">{t("crm.contacts.notFound")}</Alert>;

  const data = contact.data;

  function startEditing() {
    setForm({
      nome: data.nome,
      sobrenome: data.sobrenome ?? "",
      telefone: data.telefone ?? "",
      whatsapp: data.whatsapp ?? "",
      email: data.email ?? "",
      observacoes: data.observacoes ?? "",
    });
    setEditing(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await updateContact.mutateAsync(form);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ink">
            {data.nome} {data.sobrenome ?? ""}
          </h1>
          <LeadScoreBadge score={data.leadScore} />
          {data.bloqueado && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {t("crm.contacts.block.badge")}
            </span>
          )}
        </div>
        {data.tags.length > 0 && (
          <div className="mt-1 flex gap-1">
            {data.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-dim">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t("crm.contacts.dataSection")}</h2>
          {!editing && (
            <Button variant="secondary" onClick={startEditing}>
              {t("common.edit")}
            </Button>
          )}
        </div>

        {editing ? (
          <form onSubmit={onSave} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t("crm.contacts.name")} required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <Field label={t("crm.contacts.surname")} value={form.sobrenome} onChange={(e) => setForm({ ...form, sobrenome: e.target.value })} />
              <Field label={t("crm.contacts.whatsapp")} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              <Field label={t("crm.contacts.phone")} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              <Field label={t("crm.contacts.email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <Field label={t("crm.contacts.notes")} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            <div className="flex gap-2">
              <Button type="submit" loading={updateContact.isPending}>
                {t("common.save")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <PhoneInfo label={t("crm.contacts.whatsapp")} value={data.whatsapp} />
            <PhoneInfo label={t("crm.contacts.phone")} value={data.telefone} />
            <Info label={t("crm.contacts.email")} value={data.email} />
            <Info label={t("crm.contacts.origin")} value={data.origem} />
            {(data.cpf || data.cnpj) && <Info label={data.cpf ? t("crm.contacts.cpf") : t("crm.contacts.cnpj")} value={data.cpf ?? data.cnpj} />}
            {customFieldDefinitions.data
              ?.filter((def) => def.ativo)
              .map((def) => (
                <Info key={def.id} label={def.nome} value={formatCustomFieldValue(data.customFields?.[def.chave])} />
              ))}
            {data.observacoes && (
              <div className="col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("crm.contacts.notes")}</dt>
                <dd className="mt-0.5 text-ink">{data.observacoes}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.contacts.lgpd.title")}</h2>
        <p className="mb-4 text-sm text-ink-dim">{t("crm.contacts.lgpd.subtitle")}</p>

        {data.anonymizedAt ? (
          <p className="text-sm text-ink-faint">{t("crm.contacts.lgpd.alreadyAnonymized")}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={apiUrl(`/crm/contacts/${params.id}/lgpd/export`)}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              {t("crm.contacts.lgpd.export")}
            </a>

            {confirmingAnonymize ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{t("crm.contacts.lgpd.confirmText")}</span>
                <Button
                  variant="danger"
                  loading={anonymizeContact.isPending}
                  onClick={async () => {
                    await anonymizeContact.mutateAsync();
                    setConfirmingAnonymize(false);
                  }}
                >
                  {t("crm.contacts.lgpd.confirmYes")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingAnonymize(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmingAnonymize(true)}>
                {t("crm.contacts.lgpd.anonymize")}
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.contacts.block.title")}</h2>
        <p className="mb-4 text-sm text-ink-dim">{t("crm.contacts.block.subtitle")}</p>

        {data.bloqueado ? (
          <div className="flex flex-col gap-2">
            {data.bloqueadoMotivo && <p className="text-sm text-ink-dim">{t("crm.contacts.block.reasonLabel")}: {data.bloqueadoMotivo}</p>}
            <div>
              <Button variant="secondary" loading={unblockContact.isPending} onClick={() => unblockContact.mutate()}>
                {t("crm.contacts.block.unblock")}
              </Button>
            </div>
          </div>
        ) : showBlockForm ? (
          <div className="flex flex-col gap-2">
            <Field label={t("crm.contacts.block.reasonLabel")} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
            <div className="flex gap-2">
              <Button
                variant="danger"
                loading={blockContact.isPending}
                onClick={async () => {
                  await blockContact.mutateAsync(blockReason || undefined);
                  setShowBlockForm(false);
                  setBlockReason("");
                }}
              >
                {t("crm.contacts.block.confirm")}
              </Button>
              <Button variant="ghost" onClick={() => setShowBlockForm(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setShowBlockForm(true)}>
            {t("crm.contacts.block.block")}
          </Button>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.contacts.merge.title")}</h2>
        <p className="mb-4 text-sm text-ink-dim">{t("crm.contacts.merge.subtitle")}</p>

        {showMergeForm ? (
          <div className="flex flex-col gap-2">
            <Field
              label={t("crm.contacts.merge.duplicateIdLabel")}
              value={mergeDuplicateId}
              onChange={(e) => setMergeDuplicateId(e.target.value)}
              placeholder={t("crm.contacts.merge.duplicateIdPlaceholder")}
            />
            {mergeContacts.error && <Alert tone="error">{t("crm.contacts.merge.error")}</Alert>}
            <div className="flex gap-2">
              <Button
                variant="danger"
                loading={mergeContacts.isPending}
                disabled={!mergeDuplicateId}
                onClick={async () => {
                  await mergeContacts.mutateAsync(mergeDuplicateId);
                  setShowMergeForm(false);
                  setMergeDuplicateId("");
                }}
              >
                {t("crm.contacts.merge.confirm")}
              </Button>
              <Button variant="ghost" onClick={() => setShowMergeForm(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setShowMergeForm(true)}>
            {t("crm.contacts.merge.start")}
          </Button>
        )}
      </section>

      <ContactTasks contactId={params.id} />
    </div>
  );
}

/** Só usado na ficha de detalhe (somente leitura) — a lista de contatos e o formulário de edição continuam mostrando o número puro. */
function formatPhone(raw: string | null): string | null {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}

function formatCustomFieldValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-ink">{value ?? "—"}</dd>
    </div>
  );
}

/** `wa.me` exige o número com código do país — números só com DDD (10/11 dígitos) recebem o prefixo 55 (Brasil); números que já vieram com código do país ficam como estão. */
function whatsAppUrl(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountryCode}`;
}

function PhoneInfo({ label, value }: { label: string; value: string | null }) {
  const { t } = useI18n();
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-ink">
        {formatPhone(value) ?? "—"}
        {value && (
          <a
            href={whatsAppUrl(value)}
            target="_blank"
            rel="noreferrer"
            title={t("crm.contacts.openWhatsapp")}
            className="text-brand-600 hover:text-brand-700"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.9L2 22l5.25-1.28A9.96 9.96 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm5.86 14.3c-.25.7-1.25 1.29-2.03 1.45-.55.11-1.27.2-3.68-.79-2.94-1.22-4.84-4.13-4.99-4.32-.14-.19-1.2-1.6-1.2-3.06s.75-2.16 1.02-2.46c.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.25.6.85 2.06.92 2.21.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.13-.28.28-.12.55.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.68-.18 1.37z" />
            </svg>
          </a>
        )}
      </dd>
    </div>
  );
}
