"use client";

import { useState } from "react";
import {
  useCreateTenantUser,
  useDeleteTenantUser,
  useTenantUsers,
  useUpdateTenantUser,
  type TenantUser,
} from "@/lib/tenant-users";
import { useRoles } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api-client";

export default function TenantUsersPage() {
  const { t } = useI18n();
  const users = useTenantUsers();
  const roles = useRoles();
  const [showForm, setShowForm] = useState(false);

  const roleNameById = new Map((roles.data ?? []).map((r) => [r.id, r.nome]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{t("tenantUsers.title")}</h1>
          <p className="mt-1 text-sm text-ink-dim">{t("tenantUsers.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("tenantUsers.new")}</Button>
      </div>

      {showForm && <NewUserForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("tenantUsers.columnName")}</th>
              <th className="px-4 py-2">{t("tenantUsers.columnEmail")}</th>
              <th className="px-4 py-2">{t("tenantUsers.columnRole")}</th>
              <th className="px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.data?.map((user) => (
              <UserRow key={user.id} user={user} roleNameById={roleNameById} />
            ))}
            {users.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  {t("tenantUsers.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ user, roleNameById }: { user: TenantUser; roleNameById: Map<string, string> }) {
  const { t } = useI18n();
  const roles = useRoles();
  const updateUser = useUpdateTenantUser();
  const deleteUser = useDeleteTenantUser();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <tr className="border-b border-line last:border-0">
        <td className="px-4 py-2 font-medium text-ink">{user.nome}</td>
        <td className="px-4 py-2 text-ink-dim">{user.email}</td>
        <td className="px-4 py-2 text-ink-dim">{roleNameById.get(user.roleId) ?? "—"}</td>
        <td className="px-4 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              user.status === "active" ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-dim"
            }`}
          >
            {t(user.status === "active" ? "tenantUsers.status.active" : "tenantUsers.status.inactive")}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs font-medium text-brand-700 hover:underline">
              {editing ? t("common.cancel") : t("tenantUsers.edit")}
            </button>
            <button
              type="button"
              onClick={() =>
                updateUser.mutate({ id: user.id, status: user.status === "active" ? "inactive" : "active" })
              }
              className="text-xs font-medium text-ink-dim hover:underline"
            >
              {user.status === "active" ? t("tenantUsers.deactivate") : t("tenantUsers.activate")}
            </button>
            <button type="button" onClick={() => deleteUser.mutate(user.id)} className="text-xs font-medium text-red-600 hover:underline">
              {t("common.remove")}
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-line last:border-0">
          <td colSpan={5} className="bg-surface-alt px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-dim">{t("tenantUsers.columnRole")}</label>
                <select
                  value={user.roleId}
                  onChange={(e) => updateUser.mutate({ id: user.id, roleId: e.target.value })}
                  className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
                >
                  {roles.data?.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function NewUserForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const roles = useRoles();
  const createUser = useCreateTenantUser();
  const [form, setForm] = useState({ nome: "", email: "", senha: "", roleId: "" });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.roleId) return;
    try {
      await createUser.mutateAsync(form);
      setForm({ nome: "", email: "", senha: "", roleId: "" });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("tenantUsers.errorGeneric"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("tenantUsers.name")} required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <Field
          label={t("tenantUsers.email")}
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Field
          label={t("tenantUsers.password")}
          type="password"
          required
          minLength={10}
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("tenantUsers.columnRole")}</label>
          <select
            value={form.roleId}
            onChange={(e) => setForm({ ...form, roleId: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("tenantUsers.selectRole")}</option>
            {roles.data?.map((role) => (
              <option key={role.id} value={role.id}>
                {role.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Button type="submit" loading={createUser.isPending} disabled={!form.roleId}>
          {t("tenantUsers.create")}
        </Button>
      </div>
    </form>
  );
}
