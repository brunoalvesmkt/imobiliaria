"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContacts, useContactOrigins, useImportContacts, type ContactPhoneType } from "@/lib/crm";
import { LeadScoreBadge } from "@/components/crm/lead-score-badge";
import { ContactForm } from "@/components/crm/contact-form";
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
  const router = useRouter();
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
  const settingsItems: DropdownMenuItem[] = [
    { label: t("crm.origins.title"), onClick: () => router.push("/painel/configuracoes/origens") },
    { label: t("crm.leadScore.configTitle"), onClick: () => router.push("/painel/configuracoes/lead-score") },
    { label: t("quality.configTitle"), onClick: () => router.push("/painel/configuracoes/qualidade") },
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
          <DropdownMenu label={t("crm.funnel.settings")} items={settingsItems} />
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

      {showForm && <ContactForm onDone={() => setShowForm(false)} />}

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

