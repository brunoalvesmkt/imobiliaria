"use client";

import { useState } from "react";
import Link from "next/link";
import { useAffiliates, useCreateAffiliate, type Affiliate } from "@/lib/master-affiliates";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { apiUrl } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { AffiliateStatusBadge } from "./status-badge";

export default function MasterAffiliatesPage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const affiliates = useAffiliates();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{t("master.affiliates.title")}</h1>
        <div className="flex items-center gap-3">
          <a href={apiUrl("/master/affiliates/export")} className="text-sm text-accent hover:underline">
            {t("master.export.csv")}
          </a>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("master.affiliates.newAffiliate")}</Button>
        </div>
      </div>

      {showForm && <NewAffiliateForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("master.affiliates.columnName")}</th>
              <th className="px-4 py-2">{t("master.affiliates.email")}</th>
              <th className="px-4 py-2">{t("master.affiliates.columnStatus")}</th>
              <th className="px-4 py-2">{t("master.affiliates.columnLinkCode")}</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.data?.map((affiliate) => (
              <AffiliateRow key={affiliate.id} affiliate={affiliate} />
            ))}
            {affiliates.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AffiliateRow({ affiliate }: { affiliate: Affiliate }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 font-medium text-ink">
        <Link href={`/master/painel/afiliados/${affiliate.id}`} className="hover:underline">
          {affiliate.nome} {affiliate.sobrenome}
        </Link>
      </td>
      <td className="px-4 py-2 text-ink-dim">{affiliate.email}</td>
      <td className="px-4 py-2">
        <AffiliateStatusBadge status={affiliate.status} />
      </td>
      <td className="px-4 py-2 font-mono text-xs text-ink-faint">{affiliate.linkCode}</td>
    </tr>
  );
}

function NewAffiliateForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createAffiliate = useCreateAffiliate();
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createAffiliate.mutateAsync({
        nome,
        sobrenome,
        cpf,
        email,
        ...(telefone ? { telefone } : {}),
        ...(whatsapp ? { whatsapp } : {}),
      });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createAffiliate.error && <Alert tone="error">{t("master.affiliates.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("master.affiliates.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("master.affiliates.surname")} required value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
        <Field label={t("master.affiliates.cpf")} required value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="00000000000" />
        <Field label={t("master.affiliates.email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t("master.affiliates.phone")} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <Field label={t("master.affiliates.whatsapp")} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
      </div>
      <div>
        <Button type="submit" loading={createAffiliate.isPending}>
          {t("master.affiliates.create")}
        </Button>
      </div>
    </form>
  );
}
