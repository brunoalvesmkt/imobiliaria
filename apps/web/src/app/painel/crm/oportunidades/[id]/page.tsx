"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOpportunity, useUpdateOpportunity, useTransferOpportunityResponsavel, useResponsavelOptions, useFunnels, useTransferOpportunity, useCloseOpportunity } from "@/lib/crm";
import { ContactTasks } from "@/components/crm/contact-tasks";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";

export default function OpportunityDetailPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const opportunity = useOpportunity(params.id);
  const updateOpportunity = useUpdateOpportunity(params.id);
  const transferResponsavel = useTransferOpportunityResponsavel(params.id);
  const responsavelOptions = useResponsavelOptions();
  const funnels = useFunnels();
  const transferFunnel = useTransferOpportunity();
  const closeOpportunity = useCloseOpportunity();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ valor: "", produto: "", servico: "", previsaoFechamento: "", observacoes: "" });
  const [transferring, setTransferring] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferringFunnel, setTransferringFunnel] = useState(false);
  const [funnelTarget, setFunnelTarget] = useState("");

  if (opportunity.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  if (opportunity.isError || !opportunity.data) return <Alert tone="error">{t("crm.opportunityDetail.notFound")}</Alert>;

  const data = opportunity.data;
  const responsavelUsers = responsavelOptions.data ?? [];
  const otherFunnels = (funnels.data ?? []).filter((f) => f.id !== data.funnelId);

  function startEditing() {
    setForm({
      valor: data.valor ?? "",
      produto: data.produto ?? "",
      servico: data.servico ?? "",
      previsaoFechamento: data.previsaoFechamento ? data.previsaoFechamento.slice(0, 10) : "",
      observacoes: data.observacoes ?? "",
    });
    setEditing(true);
  }

  async function onSave() {
    await updateOpportunity.mutateAsync({
      ...(form.valor ? { valor: Number(form.valor) } : {}),
      produto: form.produto,
      servico: form.servico,
      ...(form.previsaoFechamento ? { previsaoFechamento: form.previsaoFechamento } : {}),
      observacoes: form.observacoes,
    });
    setEditing(false);
  }

  async function onConfirmTransfer() {
    if (!transferTarget) return;
    await transferResponsavel.mutateAsync(transferTarget);
    setTransferring(false);
    setTransferTarget("");
  }

  async function onConfirmTransferFunnel() {
    if (!funnelTarget) return;
    await transferFunnel.mutateAsync({ opportunityId: data.id, targetFunnelId: funnelTarget });
    setTransferringFunnel(false);
    setFunnelTarget("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button type="button" onClick={() => router.back()} className="mb-2 text-xs font-medium text-brand-700 hover:underline">
          {t("crm.opportunityDetail.back")}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">{data.contact.nome}</h1>
            <StatusBadge status={data.status} t={t} />
          </div>
          {data.status === "open" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => closeOpportunity.mutate({ id: data.id, resultado: "won" })}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <ThumbIcon direction="up" />
                {t("crm.funnel.win")}
              </button>
              <button
                type="button"
                onClick={() => closeOpportunity.mutate({ id: data.id, resultado: "lost" })}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <ThumbIcon direction="down" />
                {t("crm.funnel.lose")}
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-ink-dim">
          {data.funnel.nome} · {data.stage.nome}
          {data.valor && <> · R$ {Number(data.valor).toLocaleString(locale)}</>}
        </p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t("crm.opportunityDetail.leadSection")}</h2>
          <Link href={`/painel/crm/contatos/${data.contactId}`} className="text-xs font-medium text-brand-700 hover:underline">
            {t("crm.opportunityDetail.openContact")}
          </Link>
        </div>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <Info label={t("crm.contacts.origin")} value={data.contact.origemRef?.nome ?? data.contact.origem} />
          <Info label={t("crm.opportunityDetail.createdAt")} value={new Date(data.contact.createdAt).toLocaleDateString(locale)} />
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("crm.contacts.emails")}</dt>
            <dd className="mt-0.5 text-ink">
              {data.contact.emails.length > 0 ? data.contact.emails.map((e) => e.email).join(", ") : "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("crm.contacts.phones")}</dt>
            <dd className="mt-0.5 text-ink">
              {data.contact.phones.length > 0 ? data.contact.phones.map((p) => p.numero).join(", ") : "—"}
            </dd>
          </div>
          {data.contact.observacoes && <Info label={t("crm.contacts.notes")} value={data.contact.observacoes} />}
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t("crm.opportunityDetail.opportunitySection")}</h2>
          {!editing && (
            <Button variant="secondary" onClick={startEditing}>
              {t("common.edit")}
            </Button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("crm.funnel.value")} type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              <Field
                label={t("crm.opportunityDetail.closeDate")}
                type="date"
                value={form.previsaoFechamento}
                onChange={(e) => setForm({ ...form, previsaoFechamento: e.target.value })}
              />
              <Field label={t("crm.opportunityDetail.product")} value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })} />
              <Field label={t("crm.opportunityDetail.service")} value={form.servico} onChange={(e) => setForm({ ...form, servico: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">{t("crm.contacts.notes")}</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={3}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button loading={updateOpportunity.isPending} onClick={onSave}>
                {t("common.save")}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Info label={t("crm.funnel.value")} value={data.valor ? `R$ ${Number(data.valor).toLocaleString(locale)}` : null} />
            <Info
              label={t("crm.opportunityDetail.closeDate")}
              value={data.previsaoFechamento ? new Date(data.previsaoFechamento).toLocaleDateString(locale) : null}
            />
            <Info label={t("crm.opportunityDetail.product")} value={data.produto} />
            <Info label={t("crm.opportunityDetail.service")} value={data.servico} />
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
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("crm.opportunityDetail.responsavelSection")}</h2>
        {transferring ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">{t("crm.opportunityDetail.responsavelLabel")}</label>
              <select
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
              >
                {responsavelUsers.length === 0 && <option value="">{t("crm.opportunityDetail.noResponsavelOptions")}</option>}
                {responsavelUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-ink-faint">{t("crm.opportunityDetail.transferConfirmHint")}</p>
            <div className="flex gap-2">
              <Button loading={transferResponsavel.isPending} disabled={!transferTarget} onClick={onConfirmTransfer}>
                {t("crm.opportunityDetail.transferConfirm")}
              </Button>
              <Button variant="ghost" onClick={() => setTransferring(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink">{data.responsavel?.nome ?? t("crm.opportunityDetail.noResponsavel")}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setTransferTarget(data.responsavelId ?? responsavelUsers[0]?.id ?? "");
                setTransferring(true);
              }}
            >
              {t("crm.opportunityDetail.transfer")}
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("crm.opportunityDetail.funnelSection")}</h2>
        {transferringFunnel ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">{t("crm.opportunityDetail.funnelLabel")}</label>
              <select
                value={funnelTarget}
                onChange={(e) => setFunnelTarget(e.target.value)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="">{t("crm.funnel.chooseFunnel")}</option>
                {otherFunnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button loading={transferFunnel.isPending} disabled={!funnelTarget} onClick={onConfirmTransferFunnel}>
                {t("crm.opportunityDetail.transferConfirm")}
              </Button>
              <Button variant="ghost" onClick={() => setTransferringFunnel(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink">{data.funnel.nome}</p>
            {otherFunnels.length > 0 && (
              <Button variant="secondary" onClick={() => setTransferringFunnel(true)}>
                {t("crm.opportunityDetail.transfer")}
              </Button>
            )}
          </div>
        )}
      </section>

      <ContactTasks contactId={data.contactId} opportunityId={data.id} />

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("crm.opportunityDetail.historySection")}</h2>
        <ul className="flex flex-col gap-3">
          {[...data.stageHistory].reverse().map((entry, indexFromEnd, arr) => {
            const chronoIndex = arr.length - 1 - indexFromEnd;
            const isFirst = chronoIndex === 0;
            const durationMs = (entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now()) - new Date(entry.enteredAt).getTime();
            return (
              <li key={entry.id} className="flex flex-col gap-0.5 border-l-2 border-line pl-3 text-sm">
                <p className="text-ink">
                  {isFirst
                    ? t("crm.opportunityDetail.historyEntered").replace("{funnel}", data.funnel.nome).replace("{stage}", entry.stage.nome)
                    : t("crm.opportunityDetail.historyMoved").replace("{stage}", entry.stage.nome)}
                </p>
                <p className="text-xs text-ink-faint">
                  {new Date(entry.enteredAt).toLocaleString(locale)}
                  {" · "}
                  {entry.exitedAt
                    ? formatDurationHours(durationMs / 3_600_000)
                    : t("crm.opportunityDetail.historyStillHere")}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Ganhar/Perder — mesmo ícone de joinha do card do Kanban, "Perder" só gira 180° e muda de cor. */
function ThumbIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-4 w-4 ${direction === "down" ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M2 21h2a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H2v11ZM22 11.5a2 2 0 0 0-2-2h-5.42l.72-3.6a2 2 0 0 0-.49-1.74A2 2 0 0 0 13.28 3.4h-.09a1 1 0 0 0-.9.56L8.5 10H7v11h11.06a2 2 0 0 0 1.92-1.42l1.83-6.15a2 2 0 0 0 .19-.84v-1.09Z" />
    </svg>
  );
}

function StatusBadge({ status, t }: { status: "open" | "won" | "lost"; t: ReturnType<typeof useI18n>["t"] }) {
  if (status === "won") {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        {t("crm.opportunityDetail.statusWon")}
      </span>
    );
  }
  if (status === "lost") {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
        {t("crm.opportunityDetail.statusLost")}
      </span>
    );
  }
  return null;
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-ink">{value ?? "—"}</dd>
    </div>
  );
}

function formatDurationHours(hours: number): string {
  if (!hours || hours <= 0) return "—";
  const totalHours = Math.round(hours);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  if (days === 0) return `${remainingHours}h`;
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}
