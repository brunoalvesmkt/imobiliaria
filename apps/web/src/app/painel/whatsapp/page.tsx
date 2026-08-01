"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAcceptRisk,
  useConfirmConnection,
  useConnectNumber,
  useCreateNumber,
  useDeleteNumber,
  useDisconnectNumber,
  useNumbers,
  useNumberQr,
  useRiskTerm,
  useSetChatbotFlow,
  useUpdateNumber,
  type WhatsAppNumber,
} from "@/lib/whatsapp";
import { useFlows } from "@/lib/chatbot";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export default function WhatsAppPage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const numbers = useNumbers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{t("whatsapp.title")}</h1>
        <div className="flex items-center gap-3">
          <Link href="/painel/whatsapp/templates" className="text-sm font-medium text-brand-700 hover:underline">
            {t("whatsapp.templates.title")}
          </Link>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("whatsapp.newNumber")}</Button>
        </div>
      </div>

      {showForm && <NewNumberForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("whatsapp.columnName")}</th>
              <th className="px-4 py-2">{t("whatsapp.columnNumber")}</th>
              <th className="px-4 py-2">{t("whatsapp.columnType")}</th>
              <th className="px-4 py-2">{t("whatsapp.columnModality")}</th>
              <th className="px-4 py-2">{t("whatsapp.columnStatus")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {numbers.data?.map((number) => (
              <NumberRow key={number.id} number={number} />
            ))}
            {numbers.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-faint">
                  {t("whatsapp.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Provedores que trocam o próprio QR Code sozinhos (socket ativo, sem passo manual de "confirmar") — o oposto é o simulador dev, que exige o clique de confirmação. */
function usesLiveQr(number: WhatsAppNumber): boolean {
  return number.provider !== "fake_unofficial";
}

function NumberRow({ number }: { number: WhatsAppNumber }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const connect = useConnectNumber();
  const confirmConnection = useConfirmConnection();
  const disconnect = useDisconnectNumber();
  const deleteNumber = useDeleteNumber();
  const acceptRisk = useAcceptRisk();
  const riskTerm = useRiskTerm();
  const liveQr = usesLiveQr(number);
  const qr = useNumberQr(number.id, liveQr && number.status === "authenticating");

  useEffect(() => {
    if (qr.data?.status === "connected") {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] });
    }
  }, [qr.data?.status, queryClient]);

  function onDelete() {
    if (window.confirm(t("whatsapp.confirmDelete"))) {
      deleteNumber.mutate(number.id);
    }
  }

  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="px-4 py-2 font-medium text-ink">
          <NumberNameCell number={number} />
        </td>
        <td className="px-4 py-2 text-ink-dim">{number.numero}</td>
        <td className="px-4 py-2 text-ink-dim">
          {t(`whatsapp.type.${number.tipo}` as DictionaryKey)}
          {number.tipo === "chatbot" && <ChatbotFlowPicker number={number} />}
        </td>
        <td className="px-4 py-2 text-ink-dim">{t(`whatsapp.modality.${number.modalidade}` as DictionaryKey)}</td>
        <td className="px-4 py-2">
          <StatusBadge status={number.status} />
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-2">
            {number.status === "disconnected" && (
              <button
                type="button"
                onClick={() => connect.mutate(number.id)}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                {t("whatsapp.connect")}
              </button>
            )}
            {number.status === "authenticating" && !liveQr && (
              <button
                type="button"
                onClick={() => confirmConnection.mutate(number.id)}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                {t("whatsapp.confirmConnection")}
              </button>
            )}
            {number.status === "connected" && (
              <button
                type="button"
                onClick={() => disconnect.mutate(number.id)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                {t("whatsapp.disconnect")}
              </button>
            )}
            {number.modalidade === "unofficial" && !number.riskAccepted && (
              <button
                type="button"
                onClick={() => acceptRisk.mutate(number.id)}
                className="text-xs font-medium text-ink-dim hover:underline"
                title={riskTerm.data?.texto ?? t("whatsapp.acceptRiskNotice")}
              >
                {t("whatsapp.acceptRisk")}
              </button>
            )}
            {number.modalidade === "unofficial" && number.riskAccepted && (
              <span className="text-xs font-medium text-ink-faint">{t("whatsapp.riskAccepted")}</span>
            )}
            <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline">
              {t("common.remove")}
            </button>
          </div>
        </td>
      </tr>
      {(connect.data?.qrCode || (liveQr && number.status === "authenticating")) && (
        <tr className="border-b border-line last:border-0">
          <td colSpan={6} className="bg-surface-alt px-4 py-4">
            <QrPanel connectQrCode={connect.data?.qrCode} liveQrCode={qr.data?.qrCode} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Item 14.1 — apelido editável inline; clique no nome (ou no número, quando não há apelido) alterna para um input. */
function NumberNameCell({ number }: { number: WhatsAppNumber }) {
  const { t } = useI18n();
  const updateNumber = useUpdateNumber();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(number.nome ?? "");

  function save() {
    setEditing(false);
    if (value.trim() && value.trim() !== number.nome) {
      updateNumber.mutate({ id: number.id, nome: value.trim() });
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
        className="w-full rounded border border-line bg-surface px-2 py-1 text-sm"
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="text-left hover:underline" title={t("whatsapp.renameHint")}>
      {number.nome ?? t("whatsapp.unnamed")}
    </button>
  );
}

function QrPanel({ connectQrCode, liveQrCode }: { connectQrCode: string | undefined; liveQrCode: string | undefined }) {
  const { t } = useI18n();
  const qrCode = liveQrCode ?? connectQrCode;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {qrCode ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI gerada pelo backend, não um asset otimizável pelo next/image
        <img src={qrCode} alt={t("whatsapp.qrAlt")} className="h-40 w-40 rounded-md border border-line bg-white p-1" />
      ) : (
        <p className="text-xs text-ink-faint">{t("whatsapp.qrLoading")}</p>
      )}
      <p className="max-w-xs text-xs text-ink-dim">{t("whatsapp.qrInstructions")}</p>
    </div>
  );
}

function ChatbotFlowPicker({ number }: { number: WhatsAppNumber }) {
  const { t } = useI18n();
  const flows = useFlows();
  const setFlow = useSetChatbotFlow();

  return (
    <select
      value={number.chatbotFlowId ?? ""}
      onChange={(e) => setFlow.mutate({ id: number.id, chatbotFlowId: e.target.value || null })}
      className="mt-1 block w-full rounded-md border border-line bg-surface px-2 py-1 text-xs"
    >
      <option value="">{t("whatsapp.chatbotFlowNone")}</option>
      {flows.data?.map((flow) => (
        <option key={flow.id} value={flow.id}>
          {flow.nome}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status: WhatsAppNumber["status"] }) {
  const { t } = useI18n();
  const classes: Record<WhatsAppNumber["status"], string> = {
    connected: "bg-brand-50 text-brand-700",
    disconnected: "bg-surface-muted text-ink-dim",
    paused: "bg-surface-muted text-ink-dim",
    authenticating: "bg-brand-50 text-brand-700",
    unavailable: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    error: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    blocked: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>{t(`whatsapp.status.${status}` as DictionaryKey)}</span>;
}

function NewNumberForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createNumber = useCreateNumber();
  const [form, setForm] = useState<{ nome: string; tipo: "chatbot" | "atendente"; modalidade: "official_api" | "unofficial"; numero: string }>({
    nome: "",
    tipo: "atendente",
    modalidade: "unofficial",
    numero: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { nome, ...rest } = form;
      await createNumber.mutateAsync({ ...rest, ...(nome.trim() ? { nome: nome.trim() } : {}) });
      setForm({ nome: "", tipo: "atendente", modalidade: "unofficial", numero: "" });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createNumber.error && <Alert tone="error">{t("whatsapp.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field
          label={t("whatsapp.name")}
          placeholder={t("whatsapp.namePlaceholder")}
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("whatsapp.type")}</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value as typeof form.tipo })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="atendente">{t("whatsapp.type.atendente")}</option>
            <option value="chatbot">{t("whatsapp.type.chatbot")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("whatsapp.modality")}</label>
          <select
            value={form.modalidade}
            onChange={(e) => setForm({ ...form, modalidade: e.target.value as typeof form.modalidade })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="unofficial">{t("whatsapp.modality.unofficial")}</option>
            <option value="official_api">{t("whatsapp.modality.official_api")}</option>
          </select>
        </div>
        <Field
          label={t("whatsapp.number")}
          placeholder={t("whatsapp.numberPlaceholder")}
          required
          value={form.numero}
          onChange={(e) => setForm({ ...form, numero: e.target.value })}
        />
      </div>
      <div>
        <Button type="submit" loading={createNumber.isPending}>
          {t("whatsapp.createNumber")}
        </Button>
      </div>
    </form>
  );
}
