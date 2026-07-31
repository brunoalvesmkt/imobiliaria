"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAssignQueue,
  useAssume,
  useAutoAssign,
  useCloseConversation,
  useConversation,
  useInbox,
  useQueues,
  useReopenConversation,
  useReturnToQueue,
  useSendMessage,
  useTransfer,
  type Conversation,
  type ConversationDetail,
  type Message,
} from "@/lib/atendimento";
import { useQuickMessages, useRenderQuickMessage } from "@/lib/quick-messages";
import { useRealtimeEvent, useRealtimeSocket } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { useAnalyzeConversation, useConversationEvaluations } from "@/lib/quality";
import { useActiveModules, useCurrentUser } from "@/lib/auth";

const STATUS_TABS: { labelKey: DictionaryKey; value: string }[] = [
  { labelKey: "atendimento.inbox.filter.open", value: "open" },
  { labelKey: "atendimento.inbox.filter.pending", value: "pending" },
  { labelKey: "atendimento.inbox.filter.closed", value: "closed" },
];

export default function InboxPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inbox = useInbox(status);
  const queryClient = useQueryClient();

  // Novas mensagens/atualizações chegam pelo WebSocket (RealtimeGateway) — sem isso, a
  // caixa de entrada só atualizaria a cada poll de 15s (useInbox) ou em ação manual.
  useRealtimeEvent<{ conversationId: string; message: Message }>("conversation:message", () => {
    queryClient.invalidateQueries({ queryKey: ["atendimento", "inbox"] });
  });
  useRealtimeEvent<{ conversationId: string }>("conversation:updated", () => {
    queryClient.invalidateQueries({ queryKey: ["atendimento", "inbox"] });
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <div className={`flex-col gap-2 md:flex md:w-80 md:flex-none ${selectedId ? "hidden" : "flex"}`}>
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                status === tab.value ? "bg-brand-500 text-white" : "text-ink-dim hover:bg-surface-muted"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-1">
          {inbox.data?.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              selected={conversation.id === selectedId}
              onClick={() => setSelectedId(conversation.id)}
            />
          ))}
          {inbox.data?.length === 0 && <p className="p-3 text-sm text-ink-faint">{t("atendimento.inbox.empty")}</p>}
        </div>
      </div>

      <div className={`min-w-0 flex-1 flex-col rounded-lg border border-line bg-surface md:flex ${selectedId ? "flex" : "hidden"}`}>
        {selectedId ? (
          <ConversationPanel conversationId={selectedId} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-faint">{t("atendimento.inbox.selectConversation")}</div>
        )}
      </div>
    </div>
  );
}

function ConversationListItem({ conversation, selected, onClick }: { conversation: Conversation; selected: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm ${selected ? "bg-brand-50" : "hover:bg-surface-alt"}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-ink">{conversation.contatoNumero}</span>
        {conversation.unreadCount > 0 && (
          <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold text-white">{conversation.unreadCount}</span>
        )}
      </div>
      <span className="text-xs text-ink-faint">
        {conversation.queue?.nome ?? "—"} · {conversation.responsavel?.nome ?? t("atendimento.inbox.unassigned")}
      </span>
    </button>
  );
}

function ConversationPanel({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { t, locale } = useI18n();
  const conversation = useConversation(conversationId);
  const sendMessage = useSendMessage(conversationId);
  const [text, setText] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [showQuality, setShowQuality] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [assumeConflict, setAssumeConflict] = useState<{ responsavelNome: string | null } | null>(null);
  const currentUser = useCurrentUser();
  const activeModules = useActiveModules(currentUser.isSuccess);
  const qualityModuleEnabled = activeModules.data?.has("qualidade_ia") ?? false;
  const queryClient = useQueryClient();
  const socket = useRealtimeSocket();

  const assume = useAssume();
  const autoAssign = useAutoAssign();
  const returnToQueue = useReturnToQueue();
  const transfer = useTransfer();
  const closeConversation = useCloseConversation();
  const reopenConversation = useReopenConversation();
  const assignQueue = useAssignQueue();

  useRealtimeEvent<{ conversationId: string; message: Message }>("conversation:message", (payload) => {
    if (payload.conversationId !== conversationId) return;
    queryClient.setQueryData<ConversationDetail | undefined>(["whatsapp", "conversations", conversationId], (current) => {
      if (!current) return current;
      if (current.messages.some((m) => m.id === payload.message.id)) return current;
      return { ...current, messages: [...current.messages, payload.message] };
    });
  });
  useRealtimeEvent<{ conversationId: string }>("conversation:updated", (payload) => {
    if (payload.conversationId !== conversationId) return;
    queryClient.invalidateQueries({ queryKey: ["whatsapp", "conversations", conversationId] });
  });

  // Fase 54 (concorrência entre atendentes): avisa quem mais está com esta conversa aberta agora.
  const [viewers, setViewers] = useState<{ userId: string; userName: string }[]>([]);
  useRealtimeEvent<{ conversationId: string; viewers: { userId: string; userName: string }[] }>("conversation:viewers", (payload) => {
    if (payload.conversationId !== conversationId) return;
    setViewers(payload.viewers.filter((v) => v.userId !== currentUser.data?.id));
  });
  useEffect(() => {
    if (!socket) return;
    socket.emit("conversation:view", { conversationId });
    return () => {
      socket.emit("conversation:unview", { conversationId });
    };
  }, [socket, conversationId]);

  // Fase 55 (indicador de digitação): quem mais está digitando nesta conversa agora.
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  useRealtimeEvent<{ conversationId: string; userId: string; userName: string; isTyping: boolean }>(
    "conversation:typing",
    (payload) => {
      if (payload.conversationId !== conversationId || payload.userId === currentUser.data?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (payload.isTyping) next[payload.userId] = payload.userName;
        else delete next[payload.userId];
        return next;
      });
    },
  );
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notifyTyping() {
    if (!socket) return;
    socket.emit("conversation:typing", { conversationId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit("conversation:typing", { conversationId, isTyping: false }), 3000);
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await sendMessage.mutateAsync(text);
    setText("");
    socket?.emit("conversation:typing", { conversationId, isTyping: false });
  }

  async function onAssume(force: boolean) {
    try {
      await assume.mutateAsync({ id: conversationId, force });
      setAssumeConflict(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const body = error.body as { responsavelNome?: string | null } | undefined;
        setAssumeConflict({ responsavelNome: body?.responsavelNome ?? null });
      }
    }
  }

  if (conversation.isLoading) return <p className="p-4 text-sm text-ink-faint">{t("common.loading")}</p>;
  if (!conversation.data) return null;

  const data = conversation.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label={t("atendimento.inbox.backToList")}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-ink-dim hover:bg-surface-alt md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <p className="text-sm font-medium text-ink">{data.contatoNumero}</p>
            <p className="text-xs text-ink-faint">
              {data.queue?.nome ?? "—"} · {data.responsavel?.nome ?? t("atendimento.inbox.unassigned")}
              {viewers.length > 0 && (
                <span className="ml-2 text-brand-700">
                  · {t("atendimento.inbox.alsoViewing")}: {viewers.map((v) => v.userName).join(", ")}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {!data.responsavel && (
            <Button variant="secondary" onClick={() => onAssume(false)} loading={assume.isPending}>
              {t("atendimento.inbox.assume")}
            </Button>
          )}
          {!data.responsavel && data.queue && (
            <Button variant="secondary" onClick={() => autoAssign.mutate({ id: conversationId })} loading={autoAssign.isPending}>
              {t("atendimento.inbox.assume")} (auto)
            </Button>
          )}
          {data.responsavel && (
            <Button variant="secondary" onClick={() => returnToQueue.mutate({ id: conversationId })} loading={returnToQueue.isPending}>
              {t("atendimento.inbox.returnToQueue")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowTransfer((v) => !v)}>
            {t("atendimento.inbox.transfer")}
          </Button>
          {qualityModuleEnabled && (
            <Button variant="secondary" onClick={() => setShowQuality((v) => !v)}>
              {t("quality.title")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowQuickMessages((v) => !v)}>
            {t("atendimento.quickMessages.insert")}
          </Button>
          {data.status !== "closed" ? (
            <Button variant="danger" onClick={() => closeConversation.mutate({ id: conversationId })} loading={closeConversation.isPending}>
              {t("atendimento.inbox.close")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => reopenConversation.mutate({ id: conversationId })} loading={reopenConversation.isPending}>
              {t("atendimento.inbox.reopen")}
            </Button>
          )}
        </div>
      </div>

      {assumeConflict && (
        <div className="border-b border-line bg-surface-alt p-2">
          <Alert tone="info">
            {assumeConflict.responsavelNome
              ? t("atendimento.inbox.assumeConflict").replace("{nome}", assumeConflict.responsavelNome)
              : t("atendimento.inbox.assumeConflictGeneric")}
          </Alert>
          <div className="mt-2 flex gap-2">
            <Button variant="danger" onClick={() => onAssume(true)} loading={assume.isPending}>
              {t("atendimento.inbox.assumeAnyway")}
            </Button>
            <Button variant="ghost" onClick={() => setAssumeConflict(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}

      {showTransfer && (
        <form
          className="flex items-center gap-2 border-b border-line bg-surface-alt p-2"
          onSubmit={(e) => {
            e.preventDefault();
            transfer.mutate({ id: conversationId, body: { tenantUserId: transferTarget } });
            setShowTransfer(false);
            setTransferTarget("");
          }}
        >
          <input
            type="text"
            placeholder={t("atendimento.inbox.transferTo")}
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm"
          />
          <Button type="submit" variant="secondary">
            {t("atendimento.inbox.transferSubmit")}
          </Button>
        </form>
      )}

      {!data.queue && (
        <div className="border-b border-line bg-surface-alt p-2 text-xs text-ink-faint">
          <QueuePicker onSelect={(queueId) => assignQueue.mutate({ id: conversationId, body: { queueId } })} />
        </div>
      )}

      {showQuality && qualityModuleEnabled && <QualityPanel conversationId={conversationId} />}

      {showQuickMessages && (
        <QuickMessagesPanel
          conversationId={conversationId}
          onPick={(texto) => {
            setText(texto);
            setShowQuickMessages(false);
          }}
        />
      )}

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
        {data.messages.map((message) => (
          <MessageBubble key={message.id} message={message} locale={locale} />
        ))}
      </div>

      {Object.keys(typingUsers).length > 0 && (
        <p className="border-t border-line px-3 pt-2 text-xs italic text-ink-faint">
          {Object.values(typingUsers).join(", ")} {t("atendimento.inbox.typing")}
        </p>
      )}

      {sendMessage.isError && (
        <div className="px-3 pt-2">
          <Alert tone="error">{sendMessage.error instanceof ApiError ? sendMessage.error.message : t("atendimento.inbox.sendError")}</Alert>
        </div>
      )}

      <form onSubmit={onSend} className="flex gap-2 border-t border-line p-3">
        <input
          type="text"
          placeholder={t("atendimento.inbox.messagePlaceholder")}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            notifyTyping();
          }}
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <Button type="submit" loading={sendMessage.isPending}>
          {t("atendimento.inbox.send")}
        </Button>
      </form>
    </div>
  );
}

function QuickMessagesPanel({ conversationId, onPick }: { conversationId: string; onPick: (texto: string) => void }) {
  const { t } = useI18n();
  const messages = useQuickMessages();
  const render = useRenderQuickMessage();

  return (
    <div className="max-h-56 overflow-y-auto border-b border-line bg-surface-alt p-2">
      {messages.data?.length === 0 && <p className="p-2 text-xs text-ink-faint">{t("atendimento.quickMessages.empty")}</p>}
      <div className="flex flex-col gap-1">
        {messages.data?.map((msg) => (
          <button
            key={msg.id}
            type="button"
            onClick={async () => {
              const result = await render.mutateAsync({ id: msg.id, conversationId });
              onPick(result.texto);
            }}
            className="rounded-md px-2 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
          >
            <span className="font-medium">{msg.titulo}</span>
            <span className="ml-2 text-xs text-ink-faint">{msg.texto}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function QueuePicker({ onSelect }: { onSelect: (queueId: string) => void }) {
  const { t } = useI18n();
  const queues = useQueues();
  if (!queues.data || queues.data.length === 0) return null;
  return (
    <select
      onChange={(e) => e.target.value && onSelect(e.target.value)}
      defaultValue=""
      className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
    >
      <option value="" disabled>
        {t("atendimento.inbox.columnQueue")}…
      </option>
      {queues.data.map((q) => (
        <option key={q.id} value={q.id}>
          {q.nome}
        </option>
      ))}
    </select>
  );
}

function QualityPanel({ conversationId }: { conversationId: string }) {
  const { t, locale } = useI18n();
  const evaluations = useConversationEvaluations(conversationId);
  const analyze = useAnalyzeConversation(conversationId);
  const latest = evaluations.data?.[0];

  return (
    <div className="max-h-72 overflow-y-auto border-b border-line bg-surface-alt p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{t("quality.history")}</p>
        <Button variant="secondary" onClick={() => analyze.mutate()} loading={analyze.isPending}>
          {analyze.isPending ? t("quality.analyzing") : t("quality.analyzeButton")}
        </Button>
      </div>

      {analyze.isError && <p className="mt-2 text-xs text-red-600">{t("quality.error")}</p>}

      {!latest && !analyze.isPending && <p className="mt-2 text-xs text-ink-faint">{t("quality.empty")}</p>}

      {latest && (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white">
              {t("quality.notaGeral")}: {latest.notaGeral.toFixed(1)}
            </span>
            <span className="text-xs font-medium text-ink-dim">
              {t("quality.classificacao")}: {latest.classificacao}
            </span>
            <span className="text-[11px] text-ink-faint">{new Date(latest.createdAt).toLocaleString(locale)}</span>
          </div>

          <p className="text-xs text-ink">{latest.resumoExecutivo}</p>

          <EvaluationList title={t("quality.criteriosAvaliados")} items={latest.criteriosAvaliados.map((c) => `${c.nome}: ${c.nota}/10 — ${c.comentario}`)} />
          <EvaluationList title={t("quality.pontosPositivos")} items={latest.pontosPositivos} />
          <EvaluationList title={t("quality.pontosMelhoria")} items={latest.pontosMelhoria} />
          <EvaluationList title={t("quality.oportunidadesPerdidas")} items={latest.oportunidadesPerdidas} />
          <EvaluationList title={t("quality.momentosCriticos")} items={latest.momentosCriticos} />
          <EvaluationList title={t("quality.sugestoes")} items={latest.sugestoes} />
        </div>
      )}
    </div>
  );
}

function EvaluationList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-ink-dim">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({ message, locale }: { message: Message; locale: string }) {
  const isOut = message.direction === "out";
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
          isOut ? "bg-brand-500 text-white" : "bg-surface-muted text-ink"
        }`}
      >
        <p>{message.conteudo ?? `[${message.tipo}]`}</p>
        <p className={`mt-1 text-[10px] ${isOut ? "text-white/70" : "text-ink-faint"}`}>
          {new Date(message.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
