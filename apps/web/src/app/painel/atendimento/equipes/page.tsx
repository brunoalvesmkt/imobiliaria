"use client";

import { useState } from "react";
import {
  useAddBusinessHours,
  useAddTeamMember,
  useBusinessHours,
  useCreateQueue,
  useCreateTeam,
  useQueues,
  useRemoveTeamMember,
  useTeams,
  useUpdateQueue,
  useUpdateTeamMemberPriority,
  type Queue,
  type Team,
} from "@/lib/atendimento";
import { useTenantUsers } from "@/lib/tenant-users";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const WEEKDAY_KEYS: DictionaryKey[] = [
  "atendimento.businessHours.day.0",
  "atendimento.businessHours.day.1",
  "atendimento.businessHours.day.2",
  "atendimento.businessHours.day.3",
  "atendimento.businessHours.day.4",
  "atendimento.businessHours.day.5",
  "atendimento.businessHours.day.6",
];

export default function EquipesPage() {
  const { t } = useI18n();
  const teams = useTeams();
  const queues = useQueues();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t("atendimento.teams.title")}</h2>
        </div>
        <NewTeamForm />
        <ul className="flex flex-col gap-2">
          {teams.data?.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{t("atendimento.queues.title")}</h2>
        <NewQueueForm />
        <ul className="flex flex-col gap-2">
          {queues.data?.map((queue) => (
            <QueueCard key={queue.id} queue={queue} />
          ))}
          {queues.data?.length === 0 && <p className="text-sm text-ink-faint">{t("atendimento.queues.empty")}</p>}
        </ul>
      </section>
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  const { t } = useI18n();
  const tenantUsers = useTenantUsers();
  const addMember = useAddTeamMember(team.id);
  const removeMember = useRemoveTeamMember(team.id);
  const updatePriority = useUpdateTeamMemberPriority(team.id);
  const [selectedUserId, setSelectedUserId] = useState("");

  const memberIds = new Set(team.members.map((m) => m.tenantUserId));
  const available = tenantUsers.data?.filter((u) => !memberIds.has(u.id)) ?? [];

  return (
    <li className="rounded-lg border border-line bg-surface p-3">
      <p className="text-sm font-medium text-ink">{team.nome}</p>
      {team.members.length > 0 ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {team.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-dim"
            >
              {m.tenantUser.nome}
              <input
                type="number"
                min={0}
                defaultValue={m.prioridade}
                title={t("atendimento.teams.memberPriority")}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (value !== m.prioridade) {
                    updatePriority.mutate({ tenantUserId: m.tenantUserId, prioridade: value });
                  }
                }}
                className="w-10 rounded border border-line bg-surface px-1 py-0.5 text-center text-[11px]"
              />
              <button
                type="button"
                onClick={() => removeMember.mutate(m.tenantUserId)}
                className="text-ink-faint hover:text-red-600"
                aria-label={t("atendimento.teams.removeMember")}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-ink-faint">{t("atendimento.teams.noMembers")}</p>
      )}

      <div className="mt-2 flex gap-2">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-xs"
        >
          <option value="">{t("atendimento.teams.selectMember")}</option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          disabled={!selectedUserId}
          loading={addMember.isPending}
          onClick={() => {
            addMember.mutate({ tenantUserId: selectedUserId });
            setSelectedUserId("");
          }}
        >
          {t("atendimento.teams.addMember")}
        </Button>
      </div>
    </li>
  );
}

function QueueCard({ queue }: { queue: Queue }) {
  const { t } = useI18n();
  const updateQueue = useUpdateQueue(queue.id);
  const businessHours = useBusinessHours(queue.id);
  const addBusinessHours = useAddBusinessHours(queue.id);
  const [editing, setEditing] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [distribuicao, setDistribuicao] = useState(queue.distribuicao);
  const [prioridade, setPrioridade] = useState(String(queue.prioridade ?? 0));
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFim, setHoraFim] = useState("18:00");

  return (
    <li className="rounded-lg border border-line bg-surface p-3 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-ink">{queue.nome}</p>
          <p className="text-xs text-ink-faint">{t(`atendimento.queues.distribution.${queue.distribuicao}` as DictionaryKey)}</p>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs font-medium text-brand-700 hover:underline">
            {t("common.edit")}
          </button>
          <button type="button" onClick={() => setShowHours((v) => !v)} className="text-xs font-medium text-brand-700 hover:underline">
            {t("atendimento.businessHours.title")}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink">{t("atendimento.queues.distributionLabel")}</label>
            <select
              value={distribuicao}
              onChange={(e) => setDistribuicao(e.target.value as Queue["distribuicao"])}
              className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
            >
              <option value="round_robin">{t("atendimento.queues.distribution.round_robin")}</option>
              <option value="least_volume">{t("atendimento.queues.distribution.least_volume")}</option>
              <option value="priority">{t("atendimento.queues.distribution.priority")}</option>
            </select>
          </div>
          <Field
            label={t("atendimento.queues.priority")}
            type="number"
            min="0"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value)}
          />
          <div>
            <Button
              loading={updateQueue.isPending}
              onClick={async () => {
                await updateQueue.mutateAsync({ distribuicao, prioridade: Number(prioridade) });
                setEditing(false);
              }}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}

      {showHours && (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <ul className="flex flex-col gap-1">
            {businessHours.data?.map((bh) => (
              <li key={bh.id} className="text-xs text-ink-dim">
                {bh.diaSemana !== null ? t(WEEKDAY_KEYS[bh.diaSemana] ?? "atendimento.businessHours.day.0") : t("atendimento.businessHours.holiday")}
                {": "}
                {bh.horaInicio ?? "—"}–{bh.horaFim ?? "—"}
              </li>
            ))}
            {businessHours.data?.length === 0 && <p className="text-xs text-ink-faint">{t("atendimento.businessHours.empty")}</p>}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <select value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1 text-xs">
              {WEEKDAY_KEYS.map((key, index) => (
                <option key={key} value={index}>
                  {t(key)}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
            />
            <input
              type="time"
              value={horaFim}
              onChange={(e) => setHoraFim(e.target.value)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
            />
            <Button
              variant="secondary"
              loading={addBusinessHours.isPending}
              onClick={() => addBusinessHours.mutate({ diaSemana: Number(diaSemana), horaInicio, horaFim })}
            >
              {t("atendimento.businessHours.add")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function NewTeamForm() {
  const { t } = useI18n();
  const createTeam = useCreateTeam();
  const [nome, setNome] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createTeam.mutateAsync(nome);
    setNome("");
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 rounded-lg border border-line bg-surface p-3">
      <div className="flex-1">
        <Field label={t("atendimento.teams.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="flex items-end">
        <Button type="submit" loading={createTeam.isPending}>
          {t("atendimento.teams.create")}
        </Button>
      </div>
    </form>
  );
}

function NewQueueForm() {
  const { t } = useI18n();
  const createQueue = useCreateQueue();
  const teams = useTeams();
  const [nome, setNome] = useState("");
  const [teamId, setTeamId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createQueue.mutateAsync({ nome, ...(teamId ? { teamId } : {}) });
    setNome("");
    setTeamId("");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <Field label={t("atendimento.queues.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("atendimento.queues.team")}</label>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
          <option value="">{t("atendimento.queues.noTeam")}</option>
          {teams.data?.map((team) => (
            <option key={team.id} value={team.id}>
              {team.nome}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Button type="submit" loading={createQueue.isPending}>
          {t("atendimento.queues.create")}
        </Button>
      </div>
    </form>
  );
}
