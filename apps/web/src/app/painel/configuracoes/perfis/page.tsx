"use client";

import { useEffect, useState } from "react";
import {
  useCreateRole,
  useDeleteRole,
  usePermissionOptions,
  useRoles,
  useRole,
  useUpdateRole,
  type Role,
  type RolePermission,
} from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api-client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

function permissionKey(module: string, action: string): string {
  return `${module}:${action}`;
}

export default function RolesPage() {
  const { t } = useI18n();
  const roles = useRoles();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null);
  const deleteRole = useDeleteRole();
  const updateRole = useUpdateRole();
  const [error, setError] = useState<string | null>(null);

  async function onDelete(role: Role, substitutaRoleId?: string) {
    setError(null);
    try {
      await deleteRole.mutateAsync({ id: role.id, substitutaRoleId });
      setPendingDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !substitutaRoleId) {
        setPendingDelete(role);
        return;
      }
      setError(err instanceof ApiError ? err.message : t("roles.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{t("roles.title")}</h1>
          <p className="mt-1 text-sm text-ink-dim">{t("roles.subtitle")}</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm && !editingId ? t("common.cancel") : t("roles.new")}
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && !editingId && (
        <RoleForm
          onDone={() => setShowForm(false)}
        />
      )}

      <div className="flex flex-col gap-2">
        {roles.data?.map((role) => (
          <div key={role.id} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">
                  {role.nome} {role.isSystem && <span className="ml-1 text-xs font-normal text-ink-faint">({t("roles.system")})</span>}
                  {!role.ativo && <span className="ml-1 text-xs font-normal text-red-600">({t("roles.inactive")})</span>}
                </p>
                {role.descricao && <p className="text-xs text-ink-dim">{role.descricao}</p>}
              </div>
              {!role.isSystem && (
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-ink-dim">
                    <input
                      type="checkbox"
                      checked={role.ativo}
                      onChange={(e) => updateRole.mutate({ id: role.id, ativo: e.target.checked })}
                    />
                    {t("roles.active")}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(true);
                      setEditingId(editingId === role.id ? null : role.id);
                    }}
                    className="text-xs font-medium text-brand-700 hover:underline"
                  >
                    {editingId === role.id ? t("common.cancel") : t("roles.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(role)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    {t("common.remove")}
                  </button>
                </div>
              )}
            </div>
            {pendingDelete?.id === role.id && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-surface-muted p-2">
                <p className="text-xs text-ink-dim">{t("roles.chooseSubstitute")}</p>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onDelete(role, e.target.value);
                  }}
                  className="rounded border border-line bg-surface px-1.5 py-1 text-xs"
                >
                  <option value="">{t("roles.chooseSubstitute")}</option>
                  {roles.data
                    ?.filter((r) => r.id !== role.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={() => setPendingDelete(null)} className="text-xs text-ink-faint hover:underline">
                  {t("common.cancel")}
                </button>
              </div>
            )}
            {editingId === role.id && (
              <div className="mt-3">
                <RoleForm roleId={role.id} onDone={() => setEditingId(null)} />
              </div>
            )}
          </div>
        ))}
        {roles.data?.length === 0 && <p className="text-sm text-ink-faint">{t("roles.empty")}</p>}
      </div>
    </div>
  );
}

function RoleForm({ roleId, onDone }: { roleId?: string; onDone: () => void }) {
  const { t } = useI18n();
  const options = usePermissionOptions();
  const existing = useRole(roleId ?? "");
  const create = useCreateRole();
  const update = useUpdateRole();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (existing.data) {
      setNome(existing.data.nome);
      setDescricao(existing.data.descricao ?? "");
      setSelected(new Set(existing.data.permissions.map((p) => permissionKey(p.module, p.action))));
    }
  }, [existing.data]);

  function toggle(module: string, action: string) {
    const key = permissionKey(module, action);
    setSelected((prev) => {
      const next = new Set(prev);
      const turningOn = !next.has(key);
      if (turningOn) next.add(key);
      else next.delete(key);

      if (action === "administer" && turningOn) {
        for (const otherAction of options.data?.actions ?? []) {
          next.add(permissionKey(module, otherAction));
        }
      }

      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const permissions: RolePermission[] = Array.from(selected).map((key) => {
      const [module, action] = key.split(":");
      return { module: module!, action: action! };
    });
    try {
      if (roleId) {
        await update.mutateAsync({ id: roleId, nome, descricao: descricao || undefined, permissions });
      } else {
        await create.mutateAsync({ nome, descricao: descricao || undefined, permissions });
        setNome("");
        setDescricao("");
        setSelected(new Set());
      }
      onDone();
    } catch {
      // erro exibido pelo componente pai via estado de mutation
    }
  }

  const mutation = roleId ? update : create;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {mutation.error && <Alert tone="error">{t("roles.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("roles.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("roles.description")} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left">
              <th className="px-3 py-2 font-medium text-ink-faint">{t("roles.module")}</th>
              {options.data?.actions.map((action) => (
                <th key={action} className="px-3 py-2 text-center font-medium text-ink-faint">
                  {t(`roles.action.${action}` as DictionaryKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.data?.modules.map((module) => (
              <tr key={module} className="border-b border-line last:border-0">
                <td className="px-3 py-2 font-medium text-ink">{t(`roles.moduleName.${module}` as DictionaryKey)}</td>
                {options.data?.actions.map((action) => (
                  <td key={action} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(permissionKey(module, action))}
                      onChange={() => toggle(module, action)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <Button type="submit" loading={mutation.isPending} disabled={!nome.trim()}>
          {roleId ? t("roles.save") : t("roles.create")}
        </Button>
      </div>
    </form>
  );
}
