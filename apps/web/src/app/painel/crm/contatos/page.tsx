"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useContacts, useContactOrigins, useCreateContact, useImportContacts, type ContactPhoneType } from "@/lib/crm";
import { LeadScoreBadge } from "@/components/crm/lead-score-badge";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ApiError, apiUrl } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

const PHONE_TYPES: ContactPhoneType[] = ["whatsapp", "residencial", "comercial"];

/** `FileReader.readAsDataURL` prefixa com "data:...;base64," — o backend só quer o payload base64. */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ContatosPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [origemId, setOrigemId] = useState("");
  const [phoneType, setPhoneType] = useState<ContactPhoneType | "">("");
  const [showForm, setShowForm] = useState(false);
  const origins = useContactOrigins();
  const contacts = useContacts(search, origemId || undefined, phoneType || undefined);
  const importContacts = useImportContacts();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: { linha: number; mensagem: string }[] } | null>(null);

  async function onImportCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    try {
      const result = await importContacts.mutateAsync({ format: "csv", content: text });
      setImportResult(result);
    } catch {
      // erro exibido via importContacts.error
    }
  }

  async function onImportXlsxFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const base64 = await readFileAsBase64(file);
      const result = await importContacts.mutateAsync({ format: "xlsx", content: base64 });
      setImportResult(result);
    } catch {
      // erro exibido via importContacts.error
    }
  }

  const exportItems: DropdownMenuItem[] = [
    { label: t("relatorios.exportPdf"), onClick: () => window.open(apiUrl("/reports/export/contacts.pdf"), "_blank") },
    { label: t("relatorios.exportXlsx"), onClick: () => window.open(apiUrl("/reports/export/contacts.xlsx"), "_blank") },
    { label: t("relatorios.exportCsv"), onClick: () => window.open(apiUrl("/reports/export/contacts"), "_blank") },
  ];
  const importItems: DropdownMenuItem[] = [
    { label: t("relatorios.exportXlsx"), onClick: () => xlsxInputRef.current?.click() },
    { label: t("relatorios.exportCsv"), onClick: () => csvInputRef.current?.click() },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder={t("crm.contacts.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-md border border-line bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <FilterButton
            origins={origins.data ?? []}
            origemId={origemId}
            onOrigemChange={setOrigemId}
            phoneType={phoneType}
            onPhoneTypeChange={setPhoneType}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu label={t("crm.contacts.export")} items={exportItems} />
          <DropdownMenu label={t("crm.contacts.import")} items={importItems} />
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={onImportCsvFile} />
          <input ref={xlsxInputRef} type="file" accept=".xlsx" className="hidden" onChange={onImportXlsxFile} />
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("crm.contacts.newContact")}</Button>
        </div>
      </div>

      {importResult && (
        <Alert tone={importResult.errors.length > 0 ? "error" : "success"}>
          {t("crm.contacts.importSummary")
            .replace("{imported}", String(importResult.imported))
            .replace("{skipped}", String(importResult.skipped))
            .replace("{errors}", String(importResult.errors.length))}
        </Alert>
      )}

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
                <td className="px-4 py-2 text-ink-dim">{contact.phones.find((p) => p.principal)?.numero ?? t("common.none")}</td>
                <td className="px-4 py-2 text-ink-dim">{contact.email ?? t("common.none")}</td>
                <td className="px-4 py-2 text-ink-dim">{contact.origemRef?.nome ?? contact.origem ?? t("common.none")}</td>
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

function FilterButton({
  origins,
  origemId,
  onOrigemChange,
  phoneType,
  onPhoneTypeChange,
}: {
  origins: { id: string; nome: string }[];
  origemId: string;
  onOrigemChange: (value: string) => void;
  phoneType: ContactPhoneType | "";
  onPhoneTypeChange: (value: ContactPhoneType | "") => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const phoneTypeLabels: Record<ContactPhoneType, string> = {
    whatsapp: t("crm.contacts.phoneType.whatsapp"),
    residencial: t("crm.contacts.phoneType.residencial"),
    comercial: t("crm.contacts.phoneType.comercial"),
  };
  const activeCount = (origemId ? 1 : 0) + (phoneType ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        {t("crm.contacts.filter")}
        {activeCount > 0 ? ` (${activeCount})` : ""}
      </Button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-md border border-line bg-surface p-3 shadow-lg">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-dim">{t("crm.contacts.filterOrigin")}</label>
              <select
                value={origemId}
                onChange={(e) => onOrigemChange(e.target.value)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">{t("crm.contacts.filterAllOrigins")}</option>
                {origins.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-dim">{t("crm.contacts.filterPhoneType")}</label>
              <select
                value={phoneType}
                onChange={(e) => onPhoneTypeChange(e.target.value as ContactPhoneType | "")}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">{t("crm.contacts.filterAllPhoneTypes")}</option>
                {PHONE_TYPES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {phoneTypeLabels[tipo]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PhoneRow {
  numero: string;
  tipo: ContactPhoneType;
}

function NewContactForm({ onDone }: { onDone: () => void }) {
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
