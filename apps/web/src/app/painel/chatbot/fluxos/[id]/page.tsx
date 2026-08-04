"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import {
  useDuplicateFlow,
  useFlow,
  useFlowDefinition,
  useNewFlowVersion,
  usePublishFlow,
  useSaveFlowDefinition,
  type FlowEdge,
  type FlowNode,
  type FlowNodeType,
} from "@/lib/chatbot";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { FlowCardNode, type FlowCardData } from "./flow-card-node";
import { NodeInspector } from "./node-inspector";
import { ADD_MENU_OPTIONS, NODE_COLORS, defaultDataFor, type MessageMediaType } from "./node-types";

const DRAG_MIME_TYPE = "application/x-flow-node-type";
const DRAG_MIME_PRESET = "application/x-flow-node-preset";

const NODE_TYPES: NodeTypes = { flowCard: FlowCardNode };

function toReactFlowNode(node: FlowNode, index: number): Node<FlowCardData> {
  return {
    id: node.id,
    type: "flowCard",
    position: node.position ?? { x: 80 + (index % 4) * 240, y: Math.floor(index / 4) * 160 + 40 },
    data: { flowNodeType: node.type, payload: node.data ?? {} },
  };
}

function toReactFlowEdge(edge: FlowEdge): Edge {
  return { id: edge.id, source: edge.source, target: edge.target, ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}) };
}

export default function FlowBuilderPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { t } = useI18n();
  const flow = useFlow(id);
  const definition = useFlowDefinition(id);
  const saveDefinition = useSaveFlowDefinition(id);
  const publish = usePublishFlow();
  const newVersion = useNewFlowVersion();
  const duplicateFlow = useDuplicateFlow();
  const [newVersionError, setNewVersionError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowCardData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState<"saved" | "error" | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null);
  // "Publicar" só libera depois de "Salvar" — evita publicar em cima de uma definição diferente
  // do que está desenhado na tela (ver saveCurrentDefinition/onPublish mais abaixo).
  const [dirty, setDirty] = useState(false);
  // Desfazer/Refazer (Ctrl+Z-like) — snapshots de nodes/edges tirados ANTES de cada edição real.
  // Limitado a 50 passos para não crescer sem limite em sessões de edição muito longas.
  const [history, setHistory] = useState<{ nodes: Node<FlowCardData>[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node<FlowCardData>[]; edges: Edge[] }[]>([]);

  const readOnly = flow.data ? flow.data.status !== "draft" : true;

  useEffect(() => {
    if (!definition.data) return;
    if (loadedVersion === definition.data.versao) return;
    setNodes(definition.data.definicao.nodes.map(toReactFlowNode));
    setEdges(definition.data.definicao.edges.map(toReactFlowEdge));
    setLoadedVersion(definition.data.versao);
    setDirty(false);
    setHistory([]);
    setFuture([]);
  }, [definition.data, loadedVersion, setNodes, setEdges]);

  /** Tira um snapshot do estado ATUAL (antes da próxima edição ser aplicada) para a pilha de desfazer. */
  function pushHistory() {
    setHistory((h) => [...h.slice(-49), { nodes, edges }]);
    setFuture([]);
  }

  function undo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1]!;
    setFuture((f) => [{ nodes, edges }, ...f]);
    setHistory((h) => h.slice(0, -1));
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setSelectedNodeId(null);
    setDirty(true);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0]!;
    setHistory((h) => [...h, { nodes, edges }]);
    setFuture((f) => f.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
    setSelectedNodeId(null);
    setDirty(true);
  }

  // O React Flow dispara onNodesChange sozinho para eventos que não são edições reais
  // (medição inicial de tamanho ao montar = "dimensions", clique para selecionar = "select").
  // Contar esses tipos como "dirty" fazia o botão Cancelar aparecer sem nada para descartar.
  const handleNodesChange = useCallback<OnNodesChange<Node<FlowCardData>>>(
    (changes) => {
      if (changes.some((c) => c.type !== "select" && c.type !== "dimensions")) {
        pushHistory();
        setDirty(true);
      }
      onNodesChange(changes);
    },
    [onNodesChange, nodes, edges],
  );

  const handleEdgesChange = useCallback<OnEdgesChange<Edge>>(
    (changes) => {
      if (changes.some((c) => c.type !== "select")) {
        pushHistory();
        setDirty(true);
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, nodes, edges],
  );

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      pushHistory();
      setEdges((eds) => addEdge({ ...connection, id: `e-${connection.source}-${connection.sourceHandle ?? "out"}-${connection.target}` }, eds));
      setDirty(true);
    },
    [readOnly, setEdges, nodes, edges],
  );

  function addNode(type: FlowNodeType, presetTipo?: MessageMediaType) {
    addNodeAt(type, { x: 120 + nodes.length * 24, y: 120 + nodes.length * 24 }, presetTipo);
  }

  function addNodeAt(type: FlowNodeType, position: { x: number; y: number }, presetTipo?: MessageMediaType) {
    pushHistory();
    const nodeId = `${type}-${Math.random().toString(36).slice(2, 8)}`;
    const newNode: Node<FlowCardData> = {
      id: nodeId,
      type: "flowCard",
      position,
      data: { flowNodeType: type, payload: defaultDataFor(type, presetTipo) },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(nodeId);
    setDirty(true);
  }

  function addConnectedNode(sourceId: string, type: FlowNodeType, presetTipo?: MessageMediaType) {
    pushHistory();
    const source = nodes.find((n) => n.id === sourceId);
    const position = source ? { x: source.position.x, y: source.position.y + 160 } : { x: 120, y: 120 };
    const nodeId = `${type}-${Math.random().toString(36).slice(2, 8)}`;
    const newNode: Node<FlowCardData> = {
      id: nodeId,
      type: "flowCard",
      position,
      data: { flowNodeType: type, payload: defaultDataFor(type, presetTipo) },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => addEdge({ source: sourceId, target: nodeId, id: `e-${sourceId}-out-${nodeId}` }, eds));
    setSelectedNodeId(nodeId);
    setDirty(true);
  }

  function updateSelectedNodeData(payload: Record<string, unknown>) {
    if (!selectedNodeId) return;
    pushHistory();
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, payload } } : n)));
    setDirty(true);
  }

  function deleteNodeById(id: string) {
    pushHistory();
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((prev) => (prev === id ? null : prev));
    setDirty(true);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    deleteNodeById(selectedNodeId);
  }

  async function saveCurrentDefinition() {
    const flowNodes: FlowNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.data.flowNodeType,
      data: n.data.payload,
      position: n.position,
    }));
    const flowEdges: FlowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
    }));
    await saveDefinition.mutateAsync({ nodes: flowNodes, edges: flowEdges });
  }

  async function onSave() {
    setSaveMessage(null);
    try {
      await saveCurrentDefinition();
      setSaveMessage("saved");
      setDirty(false);
    } catch {
      setSaveMessage("error");
    }
  }

  /**
   * "Publicar" só fica habilitado depois de "Salvar" (ver `dirty` acima) —
   * mas ainda assim salva de novo aqui como rede de segurança, já que
   * "Publicar" valida a última definição salva no servidor, não o que está
   * desenhado na tela.
   */
  async function onPublish() {
    setPublishErrors(null);
    setSaveMessage(null);
    try {
      await saveCurrentDefinition();
      setDirty(false);
    } catch {
      setPublishErrors([t("chatbot.builder.saveError")]);
      return;
    }
    try {
      await publish.mutateAsync(id);
    } catch (err) {
      const body = (err as { body?: { errors?: { message: string }[] } }).body;
      setPublishErrors(body?.errors ? body.errors.map((e) => e.message) : [t("chatbot.errorGeneric")]);
    }
  }

  /** Descarta as alterações não salvas no canvas, voltando ao que está gravado na última versão salva — não mexe no servidor. */
  function onCancelEdits() {
    if (!definition.data) return;
    setNodes(definition.data.definicao.nodes.map(toReactFlowNode));
    setEdges(definition.data.definicao.edges.map(toReactFlowEdge));
    setSelectedNodeId(null);
    setDirty(false);
    setSaveMessage(null);
    setHistory([]);
    setFuture([]);
  }

  async function onNewVersion() {
    setNewVersionError(null);
    try {
      await newVersion.mutateAsync(id);
      // O refetch de flow/definition (invalidado pelo hook) já traz status "draft" e a
      // definição da nova versão — readOnly cai sozinho, sem precisar de mais nada aqui.
    } catch (err) {
      setNewVersionError(err instanceof ApiError ? err.message : t("chatbot.errorGeneric"));
    }
  }

  async function onDuplicate() {
    setDuplicateError(null);
    try {
      await duplicateFlow.mutateAsync(id);
      router.push("/painel/chatbot");
    } catch (err) {
      setDuplicateError(err instanceof ApiError ? err.message : t("chatbot.errorGeneric"));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/painel/chatbot" className="text-xs font-medium text-ink-dim hover:text-ink">
            ← {t("chatbot.builder.back")}
          </Link>
          <span className="text-sm font-semibold text-ink">{flow.data?.nome}</span>
          {flow.data && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-dim">
              {t(`chatbot.status.${flow.data.status}` as DictionaryKey)} · v{flow.data.versaoAtual}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <div className="relative">
              <AddNodeMenu onAdd={addNode} />
            </div>
          )}
          {!readOnly && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title={t("chatbot.builder.undo")}
                onClick={undo}
                disabled={history.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-dim hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↶
              </button>
              <button
                type="button"
                title={t("chatbot.builder.redo")}
                onClick={redo}
                disabled={future.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-dim hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-30"
              >
                ↷
              </button>
            </div>
          )}
          {saveMessage === "saved" && <span className="text-xs text-brand-700">{t("chatbot.builder.saved")}</span>}
          {saveMessage === "error" && <span className="text-xs text-red-600">{t("chatbot.builder.saveError")}</span>}
          {!readOnly && dirty && (
            <Button variant="ghost" onClick={onCancelEdits}>
              {t("common.cancel")}
            </Button>
          )}
          <Button variant="secondary" onClick={onDuplicate} loading={duplicateFlow.isPending}>
            {t("chatbot.action.duplicate")}
          </Button>
          {(flow.data?.status === "published" || flow.data?.status === "paused") && (
            <Button variant="secondary" onClick={onNewVersion} loading={newVersion.isPending}>
              {t("chatbot.action.newVersion")}
            </Button>
          )}
          {!readOnly && (
            <Button variant="secondary" onClick={onSave} loading={saveDefinition.isPending}>
              {t("chatbot.builder.save")}
            </Button>
          )}
          {flow.data?.status === "draft" && (
            <Button onClick={onPublish} loading={publish.isPending} disabled={dirty} title={dirty ? t("chatbot.builder.publishNeedsSave") : undefined}>
              {t("chatbot.builder.publish")}
            </Button>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="border-b border-line px-4 py-2">
          <Alert tone="info">{t("chatbot.builder.readOnlyNotice")}</Alert>
        </div>
      )}
      {publishErrors && (
        <div className="border-b border-line px-4 py-2">
          <Alert tone="error">
            <p className="font-medium">{t("chatbot.publishErrorsTitle")}</p>
            <ul className="mt-1 list-disc pl-4">
              {publishErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      {newVersionError && (
        <div className="border-b border-line px-4 py-2">
          <Alert tone="error">{newVersionError}</Alert>
        </div>
      )}
      {duplicateError && (
        <div className="border-b border-line px-4 py-2">
          <Alert tone="error">{duplicateError}</Alert>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ReactFlowProvider>
            <FlowCanvas
              nodes={nodes.map((n) => ({
                ...n,
                data: {
                  ...n.data,
                  selected: n.id === selectedNodeId,
                  readOnly,
                  onDeleteNode: deleteNodeById,
                  onAddConnectedNode: addConnectedNode,
                },
              }))}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              readOnly={readOnly}
              onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
              onPaneClick={() => setSelectedNodeId(null)}
              onDropNodeType={(type, presetTipo, position) => addNodeAt(type, position, presetTipo)}
            />
          </ReactFlowProvider>
        </div>

        {selectedNode && (
          <NodeInspector
            nodeId={selectedNode.id}
            flowNodeType={selectedNode.data.flowNodeType}
            payload={selectedNode.data.payload}
            currentFlowId={id}
            readOnly={readOnly}
            allNodes={nodes.filter((n) => n.id !== selectedNode.id).map((n) => ({ id: n.id, flowNodeType: n.data.flowNodeType }))}
            onChange={updateSelectedNodeData}
            onDelete={deleteSelectedNode}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}

function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  readOnly,
  onNodeClick,
  onPaneClick,
  onDropNodeType,
}: {
  nodes: Node<FlowCardData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<FlowCardData>>;
  onEdgesChange: OnEdgesChange<Edge>;
  onConnect: (connection: Connection) => void;
  readOnly: boolean;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
  onDropNodeType: (type: FlowNodeType, presetTipo: MessageMediaType | undefined, position: { x: number; y: number }) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();

  return (
    <div
      className="relative h-full w-full"
      onDragOver={(e) => {
        if (readOnly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (readOnly) return;
        const type = e.dataTransfer.getData(DRAG_MIME_TYPE) as FlowNodeType;
        if (!type) return;
        const presetTipo = (e.dataTransfer.getData(DRAG_MIME_PRESET) || undefined) as MessageMediaType | undefined;
        e.preventDefault();
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onDropNodeType(type, presetTipo, position);
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={NODE_TYPES}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesFocusable={!readOnly}
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        elementsSelectable
        onNodeClick={(_, node) => onNodeClick(node.id)}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
      >
        <Background />
        <Controls className="[&_button]:h-9 [&_button]:w-9" />
        {/* No mobile o minimap ocupa espaço demais e atrapalha o toque no canvas — a metáfora de grafo
            já exige pan/zoom por toque; escondê-lo em telas pequenas reduz o ruído, não a funcionalidade. */}
        <MiniMap pannable zoomable className="hidden sm:block" />
      </ReactFlow>
      <MobilePanHint />
    </div>
  );
}

function MobilePanHint() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem("flowBuilderPanHintDismissed") === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3 sm:hidden">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-dim shadow-lg">
        <span>{t("chatbot.builder.mobilePanHint")}</span>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem("flowBuilderPanHintDismissed", "1");
            setDismissed(true);
          }}
          className="font-semibold text-ink hover:text-brand-700"
        >
          {t("common.gotIt")}
        </button>
      </div>
    </div>
  );
}

function AddNodeMenu({ onAdd }: { onAdd: (type: FlowNodeType, presetTipo?: MessageMediaType) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDocClick() {
      setOpen(false);
    }
    // Fase de captura: o canvas do React Flow intercepta/pára a propagação de mousedown na fase
    // de bolha para lidar com pan/drag, o que impedia este listener de disparar ao clicar nele.
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [open]);

  return (
    <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        + {t("chatbot.builder.addNode")}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-md border border-line bg-surface py-1 shadow-lg">
          {ADD_MENU_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME_TYPE, opt.type);
                if (opt.presetTipo) e.dataTransfer.setData(DRAG_MIME_PRESET, opt.presetTipo);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => {
                onAdd(opt.type, opt.presetTipo);
                setOpen(false);
              }}
              className="flex w-full cursor-grab items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-alt active:cursor-grabbing"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: NODE_COLORS[opt.type] }} />
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
