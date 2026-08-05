"use client";

import { useState } from "react";
import { useContactOrigins, useCreateContact, useUpdateContact, type Contact, type ContactPhoneType } from "@/lib/crm";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

const PHONE_TYPES: ContactPhoneType[] = ["whatsapp", "residencial", "comercial"];

interface PhoneRow {
  numero: string;
  tipo: ContactPhoneType;
}

/** Formata como o resto do módulo CRM exibe telefone — "(11) 99999-9999" / "(11) 9999-9999" — enquanto o usuário digita. */
function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Formulário de contato compartilhado entre CRM > Contatos (criação e
 * edição — mesma UI nos dois casos) e CRM > Funil (botão "Cadastrar
 * contato") — um único formulário, sem duplicidade. Sem `contact`, cria um
 * contato novo; com `contact`, edita esse contato (mesmo `Contact` do
 * backend, não uma cópia — por isso aparece automaticamente na busca de
 * contatos de qualquer uma das duas telas).
 */
export function ContactForm({ contact, onDone }: { contact?: Contact; onDone: () => void }) {
  const { t } = useI18n();
  const isEditing = !!contact;
  const phoneTypeLabels: Record<ContactPhoneType, string> = {
    whatsapp: t("crm.contacts.phoneType.whatsapp"),
    residencial: t("crm.contacts.phoneType.residencial"),
    comercial: t("crm.contacts.phoneType.comercial"),
  };
  const createContact = useCreateContact();
  const updateContact = useUpdateContact(contact?.id ?? "");
  const origins = useContactOrigins();
  const [form, setForm] = useState({
    nome: contact?.nome ?? "",
    sobrenome: contact?.sobrenome ?? "",
    origemId: contact?.origemId ?? "",
    observacoes: contact?.observacoes ?? "",
  });
  const [phones, setPhones] = useState<PhoneRow[]>(
    contact && contact.phones.length > 0
      ? contact.phones.map((p) => ({ numero: maskPhone(p.numero), tipo: p.tipo }))
      : [{ numero: "", tipo: "whatsapp" }],
  );
  const [emails, setEmails] = useState<string[]>(
    contact && contact.emails.length > 0 ? contact.emails.map((e) => e.email) : [""],
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const saving = isEditing ? updateContact : createContact;

  function updatePhone(index: number, patch: Partial<PhoneRow>) {
    setPhones((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPhone() {
    setPhones((prev) => [...prev, { numero: "", tipo: "whatsapp" }]);
  }

  function removePhone(index: number) {
    setPhones((prev) => prev.filter((_, i) => i !== index));
  }

  function updateEmail(index: number, value: string) {
    setEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  }

  function addEmail() {
    setEmails((prev) => [...prev, ""]);
  }

  function removeEmail(index: number) {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!form.nome.trim()) {
      setClientError(t("crm.contacts.errorGeneric"));
      return;
    }
    if (!isEditing && !form.origemId) {
      setClientError(t("crm.contacts.errorOriginRequired"));
      return;
    }
    const validPhones = phones.filter((p) => p.numero.trim());
    const validEmails = emails.map((e) => e.trim()).filter(Boolean);

    try {
      const payload = {
        nome: form.nome,
        ...(form.sobrenome ? { sobrenome: form.sobrenome } : {}),
        ...(form.origemId ? { origemId: form.origemId } : {}),
        ...(form.observacoes ? { observacoes: form.observacoes } : {}),
        // Em edição, sempre manda a lista (mesmo vazia) — permite remover todos os telefones/e-mails. Na criação, só manda se houver algum preenchido.
        ...(isEditing || validPhones.length > 0
          ? { phones: validPhones.map((p, i) => ({ numero: p.numero.replace(/\D/g, ""), tipo: p.tipo, principal: i === 0 })) }
          : {}),
        ...(isEditing || validEmails.length > 0 ? { emails: validEmails.map((email, i) => ({ email, principal: i === 0 })) } : {}),
      };
      if (isEditing) {
        await updateContact.mutateAsync(payload);
      } else {
        await createContact.mutateAsync(payload);
        setForm({ nome: "", sobrenome: "", origemId: "", observacoes: "" });
        setPhones([{ numero: "", tipo: "whatsapp" }]);
        setEmails([""]);
      }
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {clientError && <Alert tone="error">{clientError}</Alert>}
      {!clientError && saving.error && (
        <Alert tone="error">{saving.error instanceof ApiError ? saving.error.message : t("crm.contacts.errorGeneric")}</Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("crm.contacts.name")} required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            {t("crm.contacts.origin")}
            {!isEditing && <span className="text-red-600"> *</span>}
          </label>
          <select
            value={form.origemId}
            onChange={(e) => setForm({ ...form, origemId: e.target.value })}
            required={!isEditing}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled={!isEditing}>
              {isEditing ? t("common.none") : t("crm.contacts.originPlaceholder")}
            </option>
            {origins.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink">{t("crm.contacts.emails")}</label>
        {emails.map((email, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="email"
              placeholder={t("crm.contacts.emailPlaceholder")}
              value={email}
              onChange={(e) => updateEmail(index, e.target.value)}
              className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
            {emails.length > 1 && (
              <button type="button" onClick={() => removeEmail(index)} className="text-sm text-ink-faint hover:text-red-600">
                {t("common.remove")}
              </button>
            )}
          </div>
        ))}
        <Button type="button" variant="secondary" className="w-fit" onClick={addEmail}>
          {t("crm.contacts.addEmail")}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink">{t("crm.contacts.phones")}</label>
        {phones.map((phone, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t("crm.contacts.phoneNumber")}
              value={phone.numero}
              onChange={(e) => updatePhone(index, { numero: maskPhone(e.target.value) })}
              className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
            <select
              value={phone.tipo}
              onChange={(e) => updatePhone(index, { tipo: e.target.value as ContactPhoneType })}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              {PHONE_TYPES.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {phoneTypeLabels[tipo]}
                </option>
              ))}
            </select>
            {phones.length > 1 && (
              <button type="button" onClick={() => removePhone(index)} className="text-sm text-ink-faint hover:text-red-600">
                {t("common.remove")}
              </button>
            )}
          </div>
        ))}
        <Button type="button" variant="secondary" className="w-fit" onClick={addPhone}>
          {t("crm.contacts.addPhone")}
        </Button>
      </div>

      <Field
        label={t("crm.contacts.notes")}
        value={form.observacoes}
        onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
      />

      <div>
        <Button type="submit" loading={saving.isPending}>
          {isEditing ? t("common.save") : t("crm.contacts.saveContact")}
        </Button>
      </div>
    </form>
  );
}
