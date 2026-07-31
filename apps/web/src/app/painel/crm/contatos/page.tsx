"use client";

import { useState } from "react";
import Link from "next/link";
import { useContacts, useCreateContact } from "@/lib/crm";
import { LeadScoreBadge } from "@/components/crm/lead-score-badge";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { createContactSchema } from "@chatbot-saas/validation";

export default function ContatosPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const contacts = useContacts(search);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          placeholder={t("crm.contacts.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded-md border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("crm.contacts.newContact")}</Button>
      </div>

      {showForm && <NewContactForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("crm.contacts.columnName")}</th>
              <th className="px-4 py-2">{t("crm.contacts.columnWhatsapp")}</th>
              <th className="px-4 py-2">{t("crm.contacts.columnEmail")}</th>
              <th className="px-4 py-2">{t("crm.contacts.columnOrigin")}</th>
              <th className="px-4 py-2">{t("crm.leadScore.column")}</th>
            </tr>
          </thead>
          <tbody>
            {contacts.data?.map((contact) => (
              <tr key={contact.id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                <td className="px-4 py-2">
                  <Link href={`/painel/crm/contatos/${contact.id}`} className="font-medium text-brand-700 hover:underline">
                    {contact.nome} {contact.sobrenome ?? ""}
                  </Link>
                </td>
                <td className="px-4 py-2 text-ink-dim">{contact.whatsapp ?? t("common.none")}</td>
                <td className="px-4 py-2 text-ink-dim">{contact.email ?? t("common.none")}</td>
                <td className="px-4 py-2 text-ink-dim">{contact.origem ?? t("common.none")}</td>
                <td className="px-4 py-2">
                  <LeadScoreBadge score={contact.leadScore} />
                </td>
              </tr>
            ))}
            {contacts.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  {t("crm.contacts.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewContactForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createContact = useCreateContact();
  const [form, setForm] = useState({ nome: "", telefone: "", whatsapp: "", email: "" });
  const [clientError, setClientError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    const parsed = createContactSchema.safeParse(form);
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? t("crm.contacts.errorGeneric"));
      return;
    }

    try {
      await createContact.mutateAsync(form);
      setForm({ nome: "", telefone: "", whatsapp: "", email: "" });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {clientError && <Alert tone="error">{clientError}</Alert>}
      {!clientError && createContact.error && (
        <Alert tone="error">{createContact.error instanceof ApiError ? createContact.error.message : t("crm.contacts.errorGeneric")}</Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("crm.contacts.name")} required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <Field label={t("crm.contacts.whatsapp")} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
        <Field label={t("crm.contacts.phone")} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Field label={t("crm.contacts.email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <Button type="submit" loading={createContact.isPending}>
          {t("crm.contacts.saveContact")}
        </Button>
      </div>
    </form>
  );
}
