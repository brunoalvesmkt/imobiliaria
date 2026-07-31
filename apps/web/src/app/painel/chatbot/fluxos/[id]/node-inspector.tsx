"use client";

import type { FlowNodeType, ValidationType } from "@/lib/chatbot";
import { useFlows } from "@/lib/chatbot";
import { useQueues } from "@/lib/atendimento";
import { useAiAccess, type AiProviderName } from "@/lib/ai-settings";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import type {
  AiNodeData,
  ConditionNodeData,
  ConditionOperator,
  KnowledgeQueryNodeData,
  MenuNodeData,
  MessageNodeData,
  QuestionNodeData,
  SubflowNodeData,
  TransferNodeData,
} from "./node-types";

const VALIDATION_TYPES: ValidationType[] = ["texto", "numero", "email", "cpf", "cnpj", "telefone", "data"];
const OPERATORS: ConditionOperator[] = ["equals", "contains", "exists", "not_exists"];
const AI_PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT (OpenAI)",
  google: "Gemini (Google)",
};

interface Props {
  nodeId: string;
  flowNodeType: FlowNodeType;
  payload: Record<string, unknown>;
  currentFlowId: string;
  readOnly: boolean;
  onChange: (payload: Record<string, unknown>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NodeInspector({ nodeId, flowNodeType, payload, currentFlowId, readOnly, onChange, onDelete, onClose }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex w-80 flex-none flex-col gap-3 overflow-y-auto border-l border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{t(`chatbot.builder.nodeType.${flowNodeType}` as DictionaryKey)}</h3>
        <button type="button" onClick={onClose} className="text-xs text-ink-faint hover:text-ink">
          {t("chatbot.builder.closePanel")}
        </button>
      </div>
      <p className="font-mono text-[11px] text-ink-faint">{nodeId}</p>

      <fieldset disabled={readOnly} className="flex flex-col gap-3 disabled:opacity-60">
        {flowNodeType === "message" && <MessageFields payload={payload as unknown as MessageNodeData} onChange={onChange} />}
        {flowNodeType === "question" && <QuestionFields payload={payload as unknown as QuestionNodeData} onChange={onChange} />}
        {flowNodeType === "menu" && <MenuFields payload={payload as unknown as MenuNodeData} onChange={onChange} />}
        {flowNodeType === "condition" && <ConditionFields payload={payload as unknown as ConditionNodeData} onChange={onChange} />}
        {flowNodeType === "subflow" && (
          <SubflowFields payload={payload as unknown as SubflowNodeData} currentFlowId={currentFlowId} onChange={onChange} />
        )}
        {flowNodeType === "transfer" && <TransferFields payload={payload as unknown as TransferNodeData} onChange={onChange} />}
        {flowNodeType === "ai" && <AiFields payload={payload as unknown as AiNodeData} onChange={onChange} />}
        {flowNodeType === "knowledge_query" && <KnowledgeQueryFields payload={payload as unknown as KnowledgeQueryNodeData} onChange={onChange} />}
        {(flowNodeType === "start" || flowNodeType === "end") && <p className="text-xs text-ink-faint">—</p>}
      </fieldset>

      {flowNodeType !== "start" && !readOnly && (
        <Button variant="danger" onClick={onDelete} className="mt-2">
          {t("chatbot.builder.deleteNode")}
        </Button>
      )}
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function MessageFields({ payload, onChange }: { payload: MessageNodeData; onChange: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  return (
    <>
      <Textarea label={t("chatbot.builder.field.text")} value={payload.texto ?? ""} onChange={(v) => onChange({ ...payload, texto: v })} />
    </>
  );
}

function QuestionFields({ payload, onChange }: { payload: QuestionNodeData; onChange: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  return (
    <>
      <Textarea label={t("chatbot.builder.field.text")} value={payload.texto ?? ""} onChange={(v) => onChange({ ...payload, texto: v })} />
      <Field
        label={t("chatbot.builder.field.variable")}
        value={payload.variavel ?? ""}
        onChange={(e) => onChange({ ...payload, variavel: e.target.value })}
      />
      <Select
        label={t("chatbot.builder.field.validation")}
        value={payload.validacao ?? ""}
        onChange={(v) => onChange({ ...payload, validacao: v || undefined })}
        options={[
          { value: "", label: t("chatbot.builder.noneSelected") },
          ...VALIDATION_TYPES.map((v) => ({ value: v, label: t(`chatbot.builder.validation.${v}` as DictionaryKey) })),
        ]}
      />
      <Field
        label={t("chatbot.builder.field.errorMessage")}
        value={payload.mensagemErro ?? ""}
        onChange={(e) => onChange({ ...payload, mensagemErro: e.target.value })}
      />
      <Field
        label={t("chatbot.builder.field.maxAttempts")}
        type="number"
        min={1}
        value={payload.maxTentativas ?? ""}
        onChange={(e) => onChange({ ...payload, maxTentativas: e.target.value ? Number(e.target.value) : undefined })}
      />
      <Field
        label={t("chatbot.builder.field.saveToCrm")}
        value={payload.salvarNoCrm ?? ""}
        onChange={(e) => onChange({ ...payload, salvarNoCrm: e.target.value })}
      />
      <Field
        label={t("chatbot.builder.field.leadScore")}
        type="number"
        value={payload.pontuacao ?? ""}
        onChange={(e) => onChange({ ...payload, pontuacao: e.target.value ? Number(e.target.value) : undefined })}
      />
    </>
  );
}

function MenuFields({ payload, onChange }: { payload: MenuNodeData; onChange: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  const opcoes = payload.opcoes ?? [];

  function updateOption(index: number, field: "chave" | "texto", value: string) {
    const next = opcoes.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt));
    onChange({ ...payload, opcoes: next });
  }
  function updateOptionScore(index: number, value: string) {
    const next = opcoes.map((opt, i) => (i === index ? { ...opt, pontuacao: value ? Number(value) : undefined } : opt));
    onChange({ ...payload, opcoes: next });
  }
  function addOption() {
    onChange({ ...payload, opcoes: [...opcoes, { chave: String(opcoes.length + 1), texto: "" }] });
  }
  function removeOption(index: number) {
    onChange({ ...payload, opcoes: opcoes.filter((_, i) => i !== index) });
  }

  return (
    <>
      <Textarea label={t("chatbot.builder.field.text")} value={payload.texto ?? ""} onChange={(v) => onChange({ ...payload, texto: v })} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("chatbot.builder.field.options")}</label>
        {opcoes.map((opt, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={opt.chave}
              onChange={(e) => updateOption(i, "chave", e.target.value)}
              placeholder={t("chatbot.builder.field.optionKey")}
              className="w-16 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
            <input
              value={opt.texto}
              onChange={(e) => updateOption(i, "texto", e.target.value)}
              placeholder={t("chatbot.builder.field.optionText")}
              className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              value={opt.pontuacao ?? ""}
              onChange={(e) => updateOptionScore(i, e.target.value)}
              placeholder={t("chatbot.builder.field.leadScoreShort")}
              title={t("chatbot.builder.field.leadScore")}
              className="w-16 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
            <button type="button" onClick={() => removeOption(i)} aria-label={t("common.remove")} className="text-xs text-red-600">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={addOption} className="mt-1 text-left text-xs font-medium text-brand-700 hover:underline">
          + {t("chatbot.builder.field.addOption")}
        </button>
      </div>
      <Field
        label={t("chatbot.builder.field.variable")}
        value={payload.variavel ?? ""}
        onChange={(e) => onChange({ ...payload, variavel: e.target.value })}
      />
    </>
  );
}

function ConditionFields({ payload, onChange }: { payload: ConditionNodeData; onChange: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  const showValue = payload.operador === "equals" || payload.operador === "contains";
  return (
    <>
      <Field
        label={t("chatbot.builder.field.condition.field")}
        value={payload.campo ?? ""}
        onChange={(e) => onChange({ ...payload, campo: e.target.value })}
      />
      <Select
        label={t("chatbot.builder.field.condition.operator")}
        value={payload.operador ?? "equals"}
        onChange={(v) => onChange({ ...payload, operador: v as ConditionOperator })}
        options={OPERATORS.map((op) => ({ value: op, label: t(`chatbot.builder.operator.${op}` as DictionaryKey) }))}
      />
      {showValue && (
        <Field
          label={t("chatbot.builder.field.condition.value")}
          value={payload.valor ?? ""}
          onChange={(e) => onChange({ ...payload, valor: e.target.value })}
        />
      )}
    </>
  );
}

function SubflowFields({
  payload,
  currentFlowId,
  onChange,
}: {
  payload: SubflowNodeData;
  currentFlowId: string;
  onChange: (p: Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const flows = useFlows();
  const options = (flows.data ?? []).filter((f) => f.id !== currentFlowId);
  return (
    <Select
      label={t("chatbot.builder.field.subflow")}
      value={payload.subflowId ?? ""}
      onChange={(v) => onChange({ ...payload, subflowId: v })}
      options={[{ value: "", label: t("chatbot.builder.noneSelected") }, ...options.map((f) => ({ value: f.id, label: f.nome }))]}
    />
  );
}

function TransferFields({ payload, onChange }: { payload: TransferNodeData; onChange: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  const queues = useQueues();
  return (
    <Select
      label={t("chatbot.builder.field.queue")}
      value={payload.queueId ?? ""}
      onChange={(v) => onChange({ ...payload, queueId: v || undefined })}
      options={[
        { value: "", label: t("chatbot.builder.noneSelected") },
        ...(queues.data ?? []).map((q) => ({ value: q.id, label: q.nome })),
      ]}
    />
  );
}

function AiProviderSelect({ value, onChange }: { value: string; onChange: (v: AiProviderName) => void }) {
  const { t } = useI18n();
  const access = useAiAccess();
  const usableProviders = (access.data?.providers ?? []).filter((p) => p.usable).map((p) => p.provider);

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        label={t("chatbot.builder.field.aiProvider")}
        value={value}
        onChange={(v) => onChange(v as AiProviderName)}
        options={Object.entries(AI_PROVIDER_LABELS).map(([provider, label]) => ({ value: provider, label }))}
      />
      {access.data && usableProviders.length === 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{t("chatbot.builder.field.aiNoProviderUsable")}</p>
      )}
    </div>
  );
}

function AiFields({ payload, onChange }: { payload: AiNodeData; onChange: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  return (
    <>
      <AiProviderSelect value={payload.provider ?? "anthropic"} onChange={(provider) => onChange({ ...payload, provider })} />
      <Textarea label={t("chatbot.builder.field.aiPrompt")} value={payload.prompt ?? ""} onChange={(v) => onChange({ ...payload, prompt: v })} />
      <p className="text-xs text-ink-faint">{t("chatbot.builder.field.aiPromptHint")}</p>
      <Field
        label={t("chatbot.builder.field.variable")}
        value={payload.variavel ?? ""}
        onChange={(e) => onChange({ ...payload, variavel: e.target.value || undefined })}
      />
    </>
  );
}

function KnowledgeQueryFields({ payload, onChange }: { payload: KnowledgeQueryNodeData; onChange: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  return (
    <>
      <AiProviderSelect value={payload.provider ?? "anthropic"} onChange={(provider) => onChange({ ...payload, provider })} />
      <Field
        label={t("chatbot.builder.field.knowledgeType")}
        value={payload.tipo ?? ""}
        onChange={(e) => onChange({ ...payload, tipo: e.target.value || undefined })}
        placeholder={t("chatbot.builder.field.knowledgeTypePlaceholder")}
      />
      <Field
        label={t("chatbot.builder.field.variable")}
        value={payload.variavel ?? ""}
        onChange={(e) => onChange({ ...payload, variavel: e.target.value || undefined })}
      />
    </>
  );
}
