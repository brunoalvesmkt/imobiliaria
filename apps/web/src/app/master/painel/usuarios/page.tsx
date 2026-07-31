"use client";

import { useState } from "react";
import { useCreateMasterUser, useMasterUsers, useUpdateMasterUser, type MasterRole, type MasterUser } from "@/lib/master-auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { apiUrl } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const ROLES: MasterRole[] = ["super_admin", "financeiro", "suporte"];

export default function MasterUsersPage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const users = useMasterUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{t("master.users.title")}</h1>
        <div className="flex items-center gap-3">
          <a href={apiUrl("/master/master-users/export")} className="text-sm text-accent hover:underline">
            {t("master.export.csv")}
          </a>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("master.users.newUser")}</Button>
        </div>
      </div>

      {showForm && <NewUserForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("master.users.columnName")}</th>
              <th className="px-4 py-2">{t("master.users.columnEmail")}</th>
              <th className="px-4 py-2">{t("master.users.columnRole")}</th>
              <th className="px-4 py-2">{t("master.users.columnStatus")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.data?.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
            {users.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
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

function UserRow({ user }: { user: MasterUser }) {
  const { t } = useI18n();
  const updateUser = useUpdateMasterUser();

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 font-medium text-ink">{user.nome}</td>
      <td className="px-4 py-2 text-ink-dim">{user.email}</td>
      <td className="px-4 py-2 text-ink-dim">{t(`master.users.role.${user.role}` as DictionaryKey)}</td>
      <td className="px-4 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            user.status === "active" ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint"
          }`}
        >
          {t(`master.users.status.${user.status}` as DictionaryKey)}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        <button
          type="button"
          onClick={() => updateUser.mutate({ id: user.id, status: user.status === "active" ? "inactive" : "active" })}
          className="text-xs font-medium text-ink-dim hover:underline"
        >
          {user.status === "active" ? t("master.users.deactivate") : t("master.users.activate")}
        </button>
      </td>
    </tr>
  );
}

function NewUserForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createUser = useCreateMasterUser();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<MasterRole>("suporte");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createUser.mutateAsync({ nome, email, senha, role });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createUser.error && <Alert tone="error">{t("master.users.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("master.users.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("master.users.email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t("master.users.password")} type="password" minLength={10} required value={senha} onChange={(e) => setSenha(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("master.users.role")}</label>
          <select value={role} onChange={(e) => setRole(e.target.value as MasterRole)} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`master.users.role.${r}` as DictionaryKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Button type="submit" loading={createUser.isPending}>
          {t("master.users.create")}
        </Button>
      </div>
    </form>
  );
}
