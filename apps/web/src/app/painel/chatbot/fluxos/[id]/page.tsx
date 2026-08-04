"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
  useFlow,
  useFlowDefinition,
  usePublishFlow,
  useSaveFlowDefinition,
  type FlowEdge,
  type FlowNode,
  type FlowNodeType,
} from "@/lib/chatbot";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { FlowCardNode, type FlowCardData } from "./flow-card-node";
import { NodeInspector } from "./node-inspector";
import { NODE_COLORS, defaultDataFor } from "./node-types";

const ADDABLE_TYPES: FlowNodeType[] = ["message", "question", "menu", "condition", "subflow", "transfer", "ai", "knowledge_query", "end"];
const DRAG_MIME_TYPE = "application/x-flow-node-type";

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
  const { t } = useI18n();
  const flow = useFlow(id);
  const definition = useFlowDefinition(id);
  const saveDefinition = useSaveFlowDefinition(id);
  const publish = usePublishFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowCardData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState<"saved" | "error" | null>(null);
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null);

  const readOnly = flow.data ? flow.data.status !== "draft" : true;

  useEffect(() => {
    if (!definition.data) return;
    if (loadedVersion === definition.data.versao) return;
    setNodes(definition.data.definicao.nodes.map(toReactFlowNode));
    setEdges(definition.data.definicao.edges.map(toReactFlowEdge));
    setLoadedVersion(definition.data.versao);
  }, [definition.data, loadedVersion, setNodes, setEdges]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) => addEdge({ ...connection, id: `e-${connection.source}-${connection.sourceHandle ?? "out"}-${connection.target}` }, eds));
    },
    [readOnly, setEdges],
  );

  function addNode(type: FlowNodeType) {
    addNodeAt(type, { x: 120 + nodes.length * 24, y: 120 + nodes.length * 24 });
  }

  function addNodeAt(type: FlowNodeType, position: { x: number; y: number }) {
    const nodeId = `${type}-${Math.random().toString(36).slice(2, 8)}`;
    const newNode: Node<FlowCardData> = {
      id: nodeId,
      type: "flowCard",
      position,
      data: { flowNodeType: type, payload: defaultDataFor(type) },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(nodeId);
  }

  function updateSelectedNodeData(payload: Record<string, unknown>) {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, payload } } : n)));
  }

  function deleteNodeById(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((prev) => (prev === id ? null : prev));
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    deleteNodeById(selectedNodeId);
  }

  async function onSave() {
    setSaveMessage(null);
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
    try {
      await saveDefinition.mutateAsync({ nodes: flowNodes, edges: flowEdges });
      setSaveMessage("saved");
    } catch {
      setSaveMessage("error");
    }
  }

  async function onPublish() {
    setPublishErrors(null);
    try {
      await publish.mutateAsync(id);
    } catch (err) {
      const body = (err as { body?: { errors?: { message: string }[] } }).body;
      setPublishErrors(body?.errors ? body.errors.map((e) => e.message) : [t("chatbot.errorGeneric")]);
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
          {saveMessage === "saved" && <span className="text-xs text-brand-700">{t("chatbot.builder.saved")}</span>}
          {saveMessage === "error" && <span className="text-xs text-red-600">{t("chatbot.builder.saveError")}</span>}
          {!readOnly && (
            <Button variant="secondary" onClick={onSave} loading={saveDefinition.isPending}>
              {t("chatbot.builder.save")}
            </Button>
          )}
          {flow.data?.status === "draft" && (
            <Button onClick={onPublish} loading={publish.isPending}>
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

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ReactFlowProvider>
            <FlowCanvas
              nodes={nodes.map((n) => ({
                ...n,
                data: { ...n.data, selected: n.id === selectedNodeId, readOnly, onDeleteNode: deleteNodeById },
              }))}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              readOnly={readOnly}
              onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
              onPaneClick={() => setSelectedNodeId(null)}
              onDropNodeType={(type, position) => addNodeAt(type, position)}
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
  onDropNodeType: (type: FlowNodeType, position: { x: number; y: number }) => void;
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
        e.preventDefault();
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onDropNodeType(type, position);
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

function AddNodeMenu({ onAdd }: { onAdd: (type: FlowNodeType) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
        + {t("chatbot.builder.addNode")}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-line bg-surface py-1 shadow-lg">
          {ADDABLE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME_TYPE, type);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              className="flex w-full cursor-grab items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-alt active:cursor-grabbing"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: NODE_COLORS[type] }} />
              {t(`chatbot.builder.nodeType.${type}` as DictionaryKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
