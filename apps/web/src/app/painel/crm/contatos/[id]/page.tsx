"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useContact,
  useContacts,
  useAnonymizeContact,
  useBlockContact,
  useUnblockContact,
  useDeactivateContact,
  useReactivateContact,
  useDeleteContact,
  useMergeContacts,
  useCustomFieldDefinitions,
  useContactOpportunitiesTimeline,
} from "@/lib/crm";
import { LeadScoreBadge } from "@/components/crm/lead-score-badge";
import { ContactForm } from "@/components/crm/contact-form";
import { apiUrl, ApiError } from "@/lib/api-client";
import { useIsAdmin } from "@/lib/auth";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ContactTasks } from "@/components/crm/contact-tasks";
import { useI18n } from "@/lib/i18n";

export default function ContactDetailPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const isAdmin = useIsAdmin();
  const contact = useContact(params.id);
  const anonymizeContact = useAnonymizeContact(params.id);
  const blockContact = useBlockContact(params.id);
  const unblockContact = useUnblockContact(params.id);
  const deactivateContact = useDeactivateContact(params.id);
  const reactivateContact = useReactivateContact(params.id);
  const deleteContact = useDeleteContact();
  const mergeContacts = useMergeContacts(params.id);
  const customFieldDefinitions = useCustomFieldDefinitions();
  const opportunitiesTimeline = useContactOpportunitiesTimeline(params.id);
  const [editing, setEditing] = useState(false);
  const [confirmingAnonymize, setConfirmingAnonymize] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [mergeDuplicateId, setMergeDuplicateId] = useState("");
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeSelected, setMergeSelected] = useState<{ id: string; nome: string } | null>(null);
  const mergeSearchResults = useContacts(mergeSearch);
  const [showMergeForm, setShowMergeForm] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (contact.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  if (contact.isError || !contact.data) return <Alert tone="error">{t("crm.contacts.notFound")}</Alert>;

  const data = contact.data;

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
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t("common.edit")}
            </Button>
          )}
        </div>

        {editing ? (
          <ContactForm contact={data} onDone={() => setEditing(false)} />
        ) : (
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Info label={t("crm.contacts.origin")} value={data.origemRef?.nome ?? data.origem} />
            {(data.cpf || data.cnpj) && <Info label={data.cpf ? t("crm.contacts.cpf") : t("crm.contacts.cnpj")} value={data.cpf ?? data.cnpj} />}
            {customFieldDefinitions.data
              ?.filter((def) => def.ativo)
              .map((def) => (
                <Info key={def.id} label={def.nome} value={formatCustomFieldValue(data.customFields?.[def.chave])} />
              ))}
            <div className="col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("crm.contacts.emails")}</dt>
              {data.emails.length > 0 ? (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {data.emails.map((email) => (
                    <li key={email.id} className="text-sm text-ink">
                      {email.email}
                    </li>
                  ))}
                </ul>
              ) : (
                <dd className="mt-0.5 text-ink">—</dd>
              )}
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("crm.contacts.phones")}</dt>
              {data.phones.length > 0 ? (
                <ul className="mt-1 flex flex-col gap-1.5">
                  {data.phones.map((phone) => (
                    <li key={phone.id} className="flex items-center gap-1.5 text-sm text-ink">
                      <span className="text-xs uppercase tracking-wide text-ink-faint">{phoneTypeLabel(t, phone.tipo)}:</span>
                      {formatPhone(phone.numero)}
                      <WhatsAppLink number={phone.numero} label={t("crm.contacts.openWhatsapp")} />
                    </li>
                  ))}
                </ul>
              ) : (
                <dd className="mt-0.5 text-ink">—</dd>
              )}
            </div>
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
        <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.contacts.status.title")}</h2>
        <p className="mb-4 text-sm text-ink-dim">{t("crm.contacts.status.subtitle")}</p>

        <div className="flex flex-wrap items-center gap-3">
          {data.ativo ? (
            <Button variant="secondary" loading={deactivateContact.isPending} onClick={() => deactivateContact.mutate()}>
              {t("crm.contacts.status.deactivate")}
            </Button>
          ) : (
            <>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-faint">
                {t("crm.contacts.status.inactiveBadge")}
              </span>
              <Button variant="secondary" loading={reactivateContact.isPending} onClick={() => reactivateContact.mutate()}>
                {t("crm.contacts.status.reactivate")}
              </Button>
            </>
          )}
        </div>

        {isAdmin && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-sm text-ink-dim">{t("crm.contacts.status.deleteHint")}</p>
            {deleteError && <Alert tone="error">{deleteError}</Alert>}
            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-dim">{t("crm.contacts.status.deleteConfirmText")}</span>
                <Button
                  variant="danger"
                  loading={deleteContact.isPending}
                  onClick={async () => {
                    setDeleteError(null);
                    try {
                      await deleteContact.mutateAsync(params.id);
                      router.push("/painel/crm/contatos");
                    } catch (err) {
                      setDeleteError(err instanceof ApiError ? err.message : t("crm.contacts.status.deleteErrorGeneric"));
                      setConfirmingDelete(false);
                    }
                  }}
                >
                  {t("crm.contacts.status.deleteConfirmYes")}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                {t("crm.contacts.status.delete")}
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.contacts.merge.title")}</h2>
        <p className="mb-4 text-sm text-ink-dim">{t("crm.contacts.merge.subtitle")}</p>

        {showMergeForm ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink">{t("crm.contacts.merge.duplicateIdLabel")}</label>
            {mergeSelected ? (
              <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm">
                <span className="text-ink">{mergeSelected.nome}</span>
                <button
                  type="button"
                  onClick={() => {
                    setMergeSelected(null);
                    setMergeDuplicateId("");
                    setMergeSearch("");
                  }}
                  className="text-xs font-medium text-ink-faint hover:text-red-600"
                >
                  {t("common.remove")}
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder={t("crm.contacts.merge.duplicatePlaceholder")}
                  value={mergeSearch}
                  onChange={(e) => setMergeSearch(e.target.value)}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
                />
                {mergeSearch.length > 0 && (mergeSearchResults.data?.length ?? 0) > 0 && (
                  <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-lg">
                    {mergeSearchResults
                      .data!.filter((c) => c.id !== params.id)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setMergeSelected({ id: c.id, nome: c.nome });
                            setMergeDuplicateId(c.id);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt"
                        >
                          {c.nome} {c.whatsapp ? `· ${c.whatsapp}` : c.telefone ? `· ${c.telefone}` : c.email ? `· ${c.email}` : ""}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
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
                  setMergeSelected(null);
                  setMergeSearch("");
                }}
              >
                {t("crm.contacts.merge.confirm")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMergeForm(false);
                  setMergeSelected(null);
                  setMergeDuplicateId("");
                  setMergeSearch("");
                }}
              >
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

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.contacts.timeline.title")}</h2>
        <p className="mb-4 text-sm text-ink-dim">{t("crm.contacts.timeline.subtitle")}</p>

        {opportunitiesTimeline.isLoading ? (
          <p className="text-sm text-ink-faint">{t("common.loading")}</p>
        ) : (opportunitiesTimeline.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-faint">{t("crm.contacts.timeline.empty")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {opportunitiesTimeline.data!.map((opp) => (
              <div key={opp.id} className="rounded-md border border-line p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-ink">{opp.funnelName}</span>
                    <span className="ml-2 text-xs text-ink-faint">
                      {opp.status === "open"
                        ? t("crm.contacts.timeline.statusOpen").replace("{stage}", opp.currentStageName)
                        : opp.status === "won"
                          ? t("crm.contacts.timeline.statusWon")
                          : t("crm.contacts.timeline.statusLost")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-ink-dim">
                    <span>
                      {t("crm.contacts.timeline.totalTime")}: <strong className="text-ink">{formatHoursDuration(opp.totalTimeHours)}</strong>
                    </span>
                    {opp.timeToWonHours !== null && (
                      <span>
                        {t("crm.contacts.timeline.timeToWon")}: <strong className="text-ink">{formatHoursDuration(opp.timeToWonHours)}</strong>
                      </span>
                    )}
                    {opp.timeToLostHours !== null && (
                      <span>
                        {t("crm.contacts.timeline.timeToLost")}: <strong className="text-ink">{formatHoursDuration(opp.timeToLostHours)}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <ul className="flex flex-col gap-2">
                  {opp.stages.map((stage, index) => (
                    <li key={`${stage.stageId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-ink">{stage.stageName}</span>
                      <span className="text-xs text-ink-dim">
                        {new Date(stage.enteredAt).toLocaleString(locale)}
                        {" → "}
                        {stage.exitedAt ? new Date(stage.exitedAt).toLocaleString(locale) : t("crm.contacts.timeline.stillHere")}
                        {stage.durationHours !== null && ` · ${formatHoursDuration(stage.durationHours)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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

function WhatsAppLink({ number, label }: { number: string; label: string }) {
  return (
    <a href={whatsAppUrl(number)} target="_blank" rel="noreferrer" title={label} className="text-brand-600 hover:text-brand-700">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.28 4.9L2 22l5.25-1.28A9.96 9.96 0 0012.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm5.86 14.3c-.25.7-1.25 1.29-2.03 1.45-.55.11-1.27.2-3.68-.79-2.94-1.22-4.84-4.13-4.99-4.32-.14-.19-1.2-1.6-1.2-3.06s.75-2.16 1.02-2.46c.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.25.6.85 2.06.92 2.21.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.13-.28.28-.12.55.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.68-.18 1.37z" />
      </svg>
    </a>
  );
}

/** Mesmo formato "Xd Yh" usado em Relatórios > CRM (ver report-shell.tsx) — duplicado aqui para não acoplar esta ficha a uma página de rota. */
function formatHoursDuration(hours: number): string {
  if (!hours || hours <= 0) return "—";
  const totalHours = Math.round(hours);
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  if (days === 0) return `${remainingHours}h`;
  if (remainingHours === 0) return `${days}d`;
  return `${days}d ${remainingHours}h`;
}

function phoneTypeLabel(t: ReturnType<typeof useI18n>["t"], tipo: string): string {
  if (tipo === "whatsapp") return t("crm.contacts.phoneType.whatsapp");
  if (tipo === "residencial") return t("crm.contacts.phoneType.residencial");
  if (tipo === "comercial") return t("crm.contacts.phoneType.comercial");
  return tipo;
}
