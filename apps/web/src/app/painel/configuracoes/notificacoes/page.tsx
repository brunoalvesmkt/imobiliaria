"use client";

import { useEffect, useState } from "react";
import {
  useCreateNotificationRecipient,
  useDeleteNotificationRecipient,
  useNotificationDeliveries,
  useNotificationRecipients,
  useNotificationWhatsappSettings,
  useNotificationWhatsappTypes,
  useUpdateNotificationRecipient,
  useUpdateNotificationWhatsappSettings,
  type NotificationRecipient,
} from "@/lib/notifications";
import { useNumbers } from "@/lib/whatsapp";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { NotificationTemplatesSection } from "./notification-templates-section";

export default function NotificationSettingsPage() {
  const { t } = useI18n();
  const settings = useNotificationWhatsappSettings();
  const numbers = useNumbers();
  const update = useUpdateNotificationWhatsappSettings();
  const [whatsAppNumberId, setWhatsAppNumberId] = useState("");

  useEffect(() => {
    if (settings.data) {
      setWhatsAppNumberId(settings.data.whatsAppNumberId ?? "");
    }
  }, [settings.data]);

  const connectedNumbers = numbers.data?.filter((n) => n.status === "connected") ?? [];

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ whatsAppNumberId: whatsAppNumberId || null });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("notifications.whatsappSettings.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("notifications.whatsappSettings.subtitle")}</p>
      </div>

      <form onSubmit={onSave} className="flex max-w-lg flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">{t("notifications.whatsappSettings.sourceSectionTitle")}</h2>
        {update.isError && <Alert tone="error">{t("notifications.whatsappSettings.error")}</Alert>}
        {connectedNumbers.length === 0 && <Alert tone="info">{t("notifications.whatsappSettings.noNumbers")}</Alert>}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("notifications.whatsappSettings.sourceNumber")}</label>
          <select
            value={whatsAppNumberId}
            onChange={(e) => setWhatsAppNumberId(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("notifications.whatsappSettings.none")}</option>
            {connectedNumbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.numero}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Button type="submit" loading={update.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>

      <RecipientsSection />

      <NotificationTemplatesSection />
    </div>
  );
}

function RecipientsSection() {
  const { t } = useI18n();
  const recipients = useNotificationRecipients();
  const types = useNotificationWhatsappTypes();
  const createRecipient = useCreateNotificationRecipient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("notifications.recipients.title")}</h2>
          <p className="mt-1 text-xs text-ink-dim">{t("notifications.recipients.subtitle")}</p>
        </div>
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.cancel") : t("notifications.recipients.add")}
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <RecipientForm
          typeOptions={types.data ?? []}
          onCancel={() => setShowForm(false)}
          onSubmit={async (input) => {
            setError(null);
            try {
              await createRecipient.mutateAsync(input);
              setShowForm(false);
            } catch (err) {
              const body = (err as { body?: { message?: string } }).body;
              setError(body?.message ?? t("notifications.recipients.errorGeneric"));
            }
          }}
          saving={createRecipient.isPending}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("notifications.recipients.columnName")}</th>
              <th className="px-4 py-2">{t("notifications.recipients.columnNumber")}</th>
              <th className="px-4 py-2">{t("notifications.recipients.columnTypes")}</th>
              <th className="px-4 py-2">{t("notifications.recipients.columnStatus")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {recipients.data?.map((recipient) => (
              <RecipientRow key={recipient.id} recipient={recipient} typeOptions={types.data ?? []} />
            ))}
            {recipients.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  {t("notifications.recipients.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecipientForm({
  typeOptions,
  onCancel,
  onSubmit,
  saving,
  initial,
}: {
  typeOptions: { tipo: string; label: string }[];
  onCancel: () => void;
  onSubmit: (input: { nome?: string; numero: string; tipos: string[] }) => void;
  saving: boolean;
  initial?: { nome?: string; numero?: string; tipos?: string[] };
}) {
  const { t } = useI18n();
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [allTypes, setAllTypes] = useState((initial?.tipos ?? []).length === 0);
  const [tipos, setTipos] = useState<string[]>(initial?.tipos ?? []);

  function toggleTipo(tipo: string) {
    setTipos((prev) => (prev.includes(tipo) ? prev.filter((t2) => t2 !== tipo) : [...prev, tipo]));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-alt p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("notifications.recipients.fieldName")} value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("notifications.recipients.fieldNumber")} required value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="5511999998888" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={allTypes} onChange={(e) => setAllTypes(e.target.checked)} />
          {t("notifications.recipients.allTypes")}
        </label>
        {!allTypes && (
          <div className="flex flex-wrap gap-3">
            {typeOptions.map((opt) => (
              <label key={opt.tipo} className="flex items-center gap-1.5 text-xs text-ink-dim">
                <input type="checkbox" checked={tipos.includes(opt.tipo)} onChange={() => toggleTipo(opt.tipo)} />
                {opt.label}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          loading={saving}
          onClick={() => onSubmit({ ...(nome ? { nome } : {}), numero, tipos: allTypes ? [] : tipos })}
          disabled={!numero.trim()}
        >
          {t("common.save")}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function RecipientRow({ recipient, typeOptions }: { recipient: NotificationRecipient; typeOptions: { tipo: string; label: string }[] }) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const updateRecipient = useUpdateNotificationRecipient(recipient.id);
  const deleteRecipient = useDeleteNotificationRecipient();
  const deliveries = useNotificationDeliveries(expanded ? recipient.id : "");

  async function onDelete() {
    const confirmed = window.confirm(
      t("notifications.recipients.confirmDelete").replace("{nome}", recipient.nome || recipient.numero).replace("{numero}", recipient.numero),
    );
    if (!confirmed) return;
    setDeleteError(null);
    try {
      await deleteRecipient.mutateAsync(recipient.id);
    } catch (err) {
      const body = (err as { body?: { message?: string } }).body;
      setDeleteError(body?.message ?? t("notifications.recipients.deleteError"));
    }
  }

  const typeLabels = recipient.tipos.length === 0
    ? t("notifications.recipients.allTypes")
    : recipient.tipos.map((tipo) => typeOptions.find((o) => o.tipo === tipo)?.label ?? tipo).join(", ");

  if (editing) {
    return (
      <tr className="border-b border-line last:border-0">
        <td colSpan={5} className="px-4 py-3">
          <RecipientForm
            typeOptions={typeOptions}
            initial={{ nome: recipient.nome ?? "", numero: recipient.numero, tipos: recipient.tipos }}
            saving={updateRecipient.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              await updateRecipient.mutateAsync(input);
              setEditing(false);
            }}
          />
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-alt" onClick={() => setExpanded((v) => !v)}>
        <td className="px-4 py-2 font-medium text-ink">{recipient.nome || "—"}</td>
        <td className="px-4 py-2 text-ink-dim">{recipient.numero}</td>
        <td className="px-4 py-2 text-ink-dim">{typeLabels}</td>
        <td className="px-4 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              recipient.ativo ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint"
            }`}
          >
            {recipient.ativo ? t("notifications.recipients.active") : t("notifications.recipients.inactive")}
          </span>
        </td>
        <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => updateRecipient.mutate({ ativo: !recipient.ativo })}
              className="text-xs font-medium text-ink-dim hover:underline"
            >
              {recipient.ativo ? t("notifications.recipients.deactivate") : t("notifications.recipients.activate")}
            </button>
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-ink-dim hover:underline">
              {t("common.edit")}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleteRecipient.isPending}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              {t("common.remove")}
            </button>
          </div>
        </td>
      </tr>
      {deleteError && (
        <tr className="border-b border-line last:border-0">
          <td colSpan={5} className="px-4 pb-2">
            <Alert tone="error">{deleteError}</Alert>
          </td>
        </tr>
      )}
      {expanded && (
        <tr className="border-b border-line last:border-0 bg-surface-alt/50">
          <td colSpan={5} className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("notifications.recipients.historyTitle")}</p>
            {deliveries.data?.length === 0 && <p className="text-xs text-ink-faint">{t("notifications.recipients.historyEmpty")}</p>}
            <ul className="flex flex-col gap-1.5">
              {deliveries.data?.map((d) => (
                <li key={d.id} className="flex flex-col gap-0.5 rounded-md border border-line bg-surface px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">{new Date(d.createdAt).toLocaleString(locale)}</span>
                    <span className={d.status === "sent" ? "text-brand-700" : "text-red-600"}>
                      {d.status === "sent" ? t("notifications.recipients.deliverySent") : t("notifications.recipients.deliveryFailed")}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-ink-dim">{d.mensagem}</p>
                  {d.erro && <p className="text-red-600">{d.erro}</p>}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
