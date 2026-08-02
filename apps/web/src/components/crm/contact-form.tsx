"use client";

import { useState } from "react";
import { useContactOrigins, useCreateContact, type ContactPhoneType } from "@/lib/crm";
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

/**
 * Formulário de cadastro de contato compartilhado entre CRM > Contatos e
 * CRM > Funil (botão "Cadastrar contato") — mesmo formulário, um único
 * lugar pra manter. Contato criado aqui é o mesmo `Contact` do backend,
 * então já aparece na lista de Contatos automaticamente (não é uma cópia).
 */
export function ContactForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const phoneTypeLabels: Record<ContactPhoneType, string> = {
    whatsapp: t("crm.contacts.phoneType.whatsapp"),
    residencial: t("crm.contacts.phoneType.residencial"),
    comercial: t("crm.contacts.phoneType.comercial"),
  };
  const createContact = useCreateContact();
  const origins = useContactOrigins();
  const [form, setForm] = useState({ nome: "", email: "", origemId: "" });
  const [phones, setPhones] = useState<PhoneRow[]>([{ numero: "", tipo: "whatsapp" }]);
  const [clientError, setClientError] = useState<string | null>(null);

  function updatePhone(index: number, patch: Partial<PhoneRow>) {
    setPhones((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPhone() {
    setPhones((prev) => [...prev, { numero: "", tipo: "whatsapp" }]);
  }

  function removePhone(index: number) {
    setPhones((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!form.nome.trim()) {
      setClientError(t("crm.contacts.errorGeneric"));
      return;
    }
    const validPhones = phones.filter((p) => p.numero.trim());

    try {
      await createContact.mutateAsync({
        nome: form.nome,
        ...(form.email ? { email: form.email } : {}),
        ...(form.origemId ? { origemId: form.origemId } : {}),
        ...(validPhones.length > 0 ? { phones: validPhones.map((p, i) => ({ ...p, principal: i === 0 })) } : {}),
      });
      setForm({ nome: "", email: "", origemId: "" });
      setPhones([{ numero: "", tipo: "whatsapp" }]);
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
        <Field label={t("crm.contacts.email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.contacts.origin")}</label>
          <select
            value={form.origemId}
            onChange={(e) => setForm({ ...form, origemId: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("common.none")}</option>
            {origins.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-ink">{t("crm.contacts.phones")}</label>
        {phones.map((phone, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t("crm.contacts.phoneNumber")}
              value={phone.numero}
              onChange={(e) => updatePhone(index, { numero: e.target.value })}
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

      <div>
        <Button type="submit" loading={createContact.isPending}>
          {t("crm.contacts.saveContact")}
        </Button>
      </div>
    </form>
  );
}
