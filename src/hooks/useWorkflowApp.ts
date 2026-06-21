import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Connection,
  EdgeChange,
  NodeChange,
  ReactFlowInstance,
  Viewport,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { WorkflowNodeCard } from "../components/WorkflowNodeCard";
import { createNode, initialEdges, initialNodes } from "../lib/nodeCatalog";
import {
  connectionRules,
  fromSnapshot,
  resolveConnectionRule,
  toPersistableSnapshot,
  toSnapshot,
} from "../lib/workflowGraph";
import { ApiConfig } from "../types/provider";
import {
  RunResponse,
  ImportedImage,
  RunFinishedEvent,
  RunLogEvent,
  RunMode,
  RunNodeEvent,
  RunStartedEvent,
  WorkflowEdge,
  WorkflowCanvas,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowProject,
  WorkflowSnapshot,
} from "../types/workflow";

type NodeContextMenu = {
  nodeId: string;
  imagePath?: string;
  x: number;
  y: number;
};

type NodeContextMenuDetail = NodeContextMenu;

type EdgeContextMenu = {
  edgeId: string;
  x: number;
  y: number;
};

type PaneContextMenu = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
};

type ConnectionHandleType = "source" | "target";

type ConnectionPickerOrigin = {
  nodeId: string;
  handleId: string;
  handleType: ConnectionHandleType;
};

type NodePickerMenu = PaneContextMenu & {
  candidateKinds?: WorkflowNodeKind[];
  connectionOrigin?: ConnectionPickerOrigin;
  connectionLine?: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  };
};

type ActiveConnectionDrag = ConnectionPickerOrigin & {
  startX: number;
  startY: number;
};

type ClipboardGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type ProjectSaveRequest = {
  project: WorkflowProject;
  signature: string;
};

type ActiveRunState = {
  runId: string | null;
  mode: RunMode;
  nodeIds: string[];
  isCancelling: boolean;
};

type ToastMessage = {
  id: number;
  message: string;
};

type WorkspaceUiState = {
  viewport?: Viewport;
};

const ACTIVE_NODE_STATUSES = new Set(["queued", "running"]);
const WORKSPACE_UI_STATE_KEY = "workflow.workspace.ui-state";
const AUTO_SAVE_DELAY_MS = 700;
const NODE_SETTINGS_POPOVER_DELAY_MS = 240;
const CONNECTION_PICKER_MIN_DISTANCE_PX = 80;

function readWorkspaceUiState(): WorkspaceUiState {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_UI_STATE_KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as WorkspaceUiState;
    const state = {
      viewport: isValidViewport(value.viewport) ? value.viewport : undefined,
    };
    if (state.viewport) {
      window.localStorage.setItem(WORKSPACE_UI_STATE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(WORKSPACE_UI_STATE_KEY);
    }
    return state;
  } catch {
    return {};
  }
}

function writeWorkspaceUiState(state: WorkspaceUiState) {
  window.localStorage.setItem(WORKSPACE_UI_STATE_KEY, JSON.stringify(state));
}

function isValidViewport(value: unknown): value is Viewport {
  if (!value || typeof value !== "object") return false;
  const viewport = value as Partial<Viewport>;
  return (
    typeof viewport.x === "number" &&
    Number.isFinite(viewport.x) &&
    typeof viewport.y === "number" &&
    Number.isFinite(viewport.y) &&
    typeof viewport.zoom === "number" &&
    Number.isFinite(viewport.zoom) &&
    viewport.zoom > 0
  );
}

export function useWorkflowApp() {
  const initialUiStateRef = useRef<WorkspaceUiState | null>(null);
  if (!initialUiStateRef.current) initialUiStateRef.current = readWorkspaceUiState();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenu | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenu | null>(null);
  const [paneContextMenu, setPaneContextMenu] = useState<PaneContextMenu | null>(null);
  const [nodePickerMenu, setNodePickerMenu] = useState<NodePickerMenu | null>(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [nodeSettingsNodeId, setNodeSettingsNodeId] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig>({ apiKey: "" });
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowNode, WorkflowEdge> | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRunState | null>(null);
  const [project, setProject] = useState<WorkflowProject | null>(null);
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const activeRunIdRef = useRef<string | null>(null);
  const runRequestTokenRef = useRef(0);
  const latestRunSequenceByRunIdRef = useRef(new Map<string, number>());
  const historyPastRef = useRef<WorkflowSnapshot[]>([]);
  const historyFutureRef = useRef<WorkflowSnapshot[]>([]);
  const isRestoringHistoryRef = useRef(false);
  const isDraggingNodesRef = useRef(false);
  const nodeSettingsDelayRef = useRef<number | null>(null);
  const clipboardRef = useRef<ClipboardGraph | null>(null);
  const toastSequenceRef = useRef(0);
  const latestViewportRef = useRef<Viewport | undefined>(initialUiStateRef.current.viewport);
  const activeConnectionDragRef = useRef<ActiveConnectionDrag | null>(null);
  const suppressConnectionSelectionRef = useRef(false);
  const suppressCanvasCloseUntilRef = useRef(0);
  const lastPersistedProjectSignatureRef = useRef<string | null>(null);
  const pendingAutoSaveRef = useRef<ProjectSaveRequest | null>(null);
  const isAutoSavingRef = useRef(false);

  const nodeTypes = useMemo(() => ({ workflowNode: WorkflowNodeCard }), []);
  const activeCanvas = useMemo(
    () => project?.canvases.find((canvas) => canvas.id === project.activeCanvasId) ?? null,
    [project],
  );
  const activeCanvasId = activeCanvas?.id ?? "";
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const nodeSettingsCandidateId = useMemo(() => {
    if (isDraggingNode) return null;
    if (nodeContextMenu || edgeContextMenu || paneContextMenu || nodePickerMenu) return null;
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length > 1) return null;
    return selectedNodes[0]?.id ?? selectedNode?.id ?? null;
  }, [edgeContextMenu, isDraggingNode, nodeContextMenu, nodePickerMenu, nodes, paneContextMenu, selectedNode]);
  const nodeSettingsNode = useMemo(
    () => nodes.find((node) => node.id === nodeSettingsNodeId) ?? null,
    [nodeSettingsNodeId, nodes],
  );
  const isRunActive = activeRun !== null;
  const canCancelRun = Boolean(activeRun?.runId) && !activeRun?.isCancelling;
  const selectedNodeCanCancelRun = Boolean(
    activeRun?.runId &&
      selectedNode &&
      activeRun.nodeIds.includes(selectedNode.id) &&
      ACTIVE_NODE_STATUSES.has(selectedNode.data.status),
  );

  const appendLogs = useCallback((nextLogs: string[]) => {
    const messages = nextLogs.filter((log) => log.trim().length > 0);
    if (messages.length === 0) return;

    void invoke("debug_frontend_logs", { messages }).catch(() => undefined);

    const nextToasts = messages.map((message) => {
      toastSequenceRef.current += 1;
      return { id: toastSequenceRef.current, message };
    });
    const toastIds = new Set(nextToasts.map((toast) => toast.id));

    setToasts((current) => [...nextToasts, ...current].slice(0, 6));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => !toastIds.has(toast.id)));
    }, 3800);
  }, []);

  const closeContextMenus = useCallback(() => {
    if (performance.now() < suppressCanvasCloseUntilRef.current) {
      return;
    }

    suppressConnectionSelectionRef.current = false;
    if (nodeSettingsDelayRef.current !== null) {
      window.clearTimeout(nodeSettingsDelayRef.current);
      nodeSettingsDelayRef.current = null;
    }
    setNodeSettingsNodeId(null);
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
    setPaneContextMenu(null);
    setNodePickerMenu(null);
  }, []);

  const closeConnectionPicker = useCallback(() => {
    suppressCanvasCloseUntilRef.current = 0;
    suppressConnectionSelectionRef.current = false;
    setNodePickerMenu((current) => (current?.connectionOrigin ? null : current));
  }, []);

  const connectionCandidateKinds = useCallback(
    (origin: ConnectionPickerOrigin) => {
      const originNode = nodes.find((node) => node.id === origin.nodeId);
      if (!originNode) return [];

      const candidateKinds = connectionRules
        .filter((rule) =>
          origin.handleType === "source"
            ? rule.sourceKind === originNode.data.kind && rule.sourceHandle === origin.handleId
            : rule.targetKind === originNode.data.kind && rule.targetHandle === origin.handleId,
        )
        .map((rule) => (origin.handleType === "source" ? rule.targetKind : rule.sourceKind));

      return Array.from(new Set(candidateKinds));
    },
    [nodes],
  );

  const openConnectionPicker = useCallback(
    (drag: ActiveConnectionDrag, clientX: number, clientY: number) => {
      const candidateKinds = connectionCandidateKinds(drag);
      if (candidateKinds.length === 0) return;

      const position = flowInstance
        ? flowInstance.screenToFlowPosition({ x: clientX, y: clientY })
        : { x: clientX, y: clientY };

      setSelectedNodeId(null);
      setNodeSettingsNodeId(null);
      suppressCanvasCloseUntilRef.current = performance.now() + 240;
      setNodeContextMenu(null);
      setEdgeContextMenu(null);
      setPaneContextMenu(null);
      setNodePickerMenu({
        x: clientX,
        y: clientY,
        flowX: position.x,
        flowY: position.y,
        candidateKinds,
        connectionOrigin: {
          nodeId: drag.nodeId,
          handleId: drag.handleId,
          handleType: drag.handleType,
        },
        connectionLine: {
          fromX: drag.startX,
          fromY: drag.startY,
          toX: clientX,
          toY: clientY + 18,
        },
      });
    },
    [connectionCandidateKinds, flowInstance],
  );

  useEffect(() => {
    if (nodeSettingsDelayRef.current !== null) {
      window.clearTimeout(nodeSettingsDelayRef.current);
      nodeSettingsDelayRef.current = null;
    }

    if (!nodeSettingsCandidateId) {
      setNodeSettingsNodeId(null);
      return undefined;
    }

    nodeSettingsDelayRef.current = window.setTimeout(() => {
      setNodeSettingsNodeId(nodeSettingsCandidateId);
      nodeSettingsDelayRef.current = null;
    }, NODE_SETTINGS_POPOVER_DELAY_MS);

    return () => {
      if (nodeSettingsDelayRef.current !== null) {
        window.clearTimeout(nodeSettingsDelayRef.current);
        nodeSettingsDelayRef.current = null;
      }
    };
  }, [nodeSettingsCandidateId]);

  useEffect(() => {
    appendLogs(["工作流已就绪"]);
  }, [appendLogs]);

  const persistWorkspaceUiState = useCallback((patch: WorkspaceUiState) => {
    const nextState = {
      ...readWorkspaceUiState(),
      ...patch,
    };
    writeWorkspaceUiState(nextState);
  }, []);

  const handleFlowInit = useCallback(
    (instance: ReactFlowInstance<WorkflowNode, WorkflowEdge>) => {
      setFlowInstance(instance);
      if (latestViewportRef.current) {
        window.requestAnimationFrame(() => {
          void instance.setViewport(latestViewportRef.current as Viewport);
        });
      } else {
        window.requestAnimationFrame(() => {
          void instance.fitView({ padding: 0.18 });
        });
      }
    },
    [],
  );

  const handleViewportChange = useCallback(
    (viewport: Viewport) => {
      latestViewportRef.current = viewport;
      persistWorkspaceUiState({ viewport });
    },
    [persistWorkspaceUiState],
  );

  const applySnapshot = useCallback(
    (snapshot: WorkflowSnapshot) => {
      const next = fromSnapshot(snapshot);
      setNodes(next.nodes);
      setEdges(next.edges);
      setSelectedNodeId(null);
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    invoke<WorkflowProject>("load_workflow_project")
      .then((loadedProject) => {
        const nextProject = normalizeProject(loadedProject);
        const canvas = currentCanvas(nextProject);
        setProject(nextProject);
        applySnapshot(canvas.snapshot);
        lastPersistedProjectSignatureRef.current = projectSignature(nextProject);
        appendLogs(["已恢复上次项目"]);
      })
      .catch((error) => appendLogs([`加载失败：${String(error)}`]))
      .finally(() => setIsProjectLoaded(true));
  }, [appendLogs, applySnapshot]);

  useEffect(() => {
    invoke<ApiConfig>("load_api_config")
      .then((config) => {
        setApiConfig(config);
        appendLogs(["已加载 AI 配置"]);
      })
      .catch((error) => appendLogs([`AI 配置加载失败：${String(error)}`]));
  }, [appendLogs]);

  useEffect(() => {
    const unlisteners = [
      listen<RunStartedEvent>("workflow://run/started", (event) => {
        activeRunIdRef.current = event.payload.runId;
        latestRunSequenceByRunIdRef.current.set(event.payload.runId, 0);
        setActiveRun({
          runId: event.payload.runId,
          mode: event.payload.mode,
          nodeIds: event.payload.nodeIds,
          isCancelling: false,
        });
        setNodes((current) =>
          current.map((node) =>
            event.payload.nodeIds.includes(node.id)
              ? { ...node, data: { ...node.data, status: "queued", error: undefined } }
              : node,
          ),
        );
        appendLogs([
          `${event.payload.mode === "workflow" ? "工作流" : "节点"}运行已开始：${event.payload.runId}`,
        ]);
      }),
      listen<RunNodeEvent>("workflow://run/node", (event) => {
        if (event.payload.runId !== activeRunIdRef.current) return;
        const latestSequence = latestRunSequenceByRunIdRef.current.get(event.payload.runId) ?? 0;
        if (event.payload.sequence <= latestSequence) return;
        latestRunSequenceByRunIdRef.current.set(event.payload.runId, event.payload.sequence);
        setNodes((current) =>
          current.map((node) =>
            node.id === event.payload.nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    status: event.payload.status,
                    resultPath: event.payload.node.resultPath ?? node.data.resultPath,
                    resultUrl: event.payload.node.resultUrl ?? node.data.resultUrl,
                    lastOutputPath: event.payload.node.lastOutputPath ?? node.data.lastOutputPath,
                    error: event.payload.node.error ?? event.payload.error?.message,
                  },
                }
              : node,
          ),
        );
      }),
      listen<RunLogEvent>("workflow://run/log", (event) => {
        if (event.payload.runId !== activeRunIdRef.current) return;
        appendLogs([event.payload.message]);
      }),
      listen<RunFinishedEvent>("workflow://run/finished", (event) => {
        if (event.payload.runId !== activeRunIdRef.current) return;
        const { summary } = event.payload;
        activeRunIdRef.current = null;
        setActiveRun(null);
        appendLogs([
          event.payload.status === "cancelled"
            ? `运行已打断：成功 ${summary.success}，失败 ${summary.error}，阻塞 ${summary.blocked}，跳过 ${summary.skipped}`
            : `运行结束：成功 ${summary.success}，失败 ${summary.error}，阻塞 ${summary.blocked}，跳过 ${summary.skipped}`,
        ]);
      }),
    ];

    return () => {
      void Promise.all(unlisteners).then((items) => items.forEach((unlisten) => unlisten()));
    };
  }, [appendLogs, setNodes]);

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (isEditableElement(event.target)) return;
      if (!activeCanvasId) return;

      const imageFile = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!imageFile && text.length === 0) return;

      event.preventDefault();

      try {
        if (imageFile) {
          const imported = await importImageFileData("import_clipboard_image", activeCanvasId, imageFile);
          const node = createNode("imageInput", nodes.length);
          const position = flowInstance
            ? flowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
            : node.position;

          node.position = position;
          node.data = {
            ...node.data,
            title: "粘贴图片",
            status: "success",
            imagePath: imported.imagePath,
            thumbnailPath: imported.thumbnailPath ?? undefined,
            resultPath: imported.imagePath,
          };
          setNodes((current) => [...current, node]);
          setSelectedNodeId(node.id);
          appendLogs([`已从剪切板导入图片：${imported.imagePath}`]);
          return;
        }

        const node = createNode("textInput", nodes.length);
        const position = flowInstance
          ? flowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
          : node.position;

        node.position = position;
        node.data = {
          ...node.data,
          title: "粘贴文本",
          status: "success",
          content: text,
        };
        setNodes((current) => [...current, node]);
        setSelectedNodeId(node.id);
        appendLogs([`已从剪切板导入文本：${previewTextForLog(text)}`]);
      } catch (error) {
        appendLogs([`剪切板内容导入失败：${String(error)}`]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeCanvasId, appendLogs, flowInstance, nodes.length, setNodes]);

  useEffect(() => {
    const handleImageContextMenu = (event: Event) => {
      const detail = (event as CustomEvent<NodeContextMenuDetail>).detail;
      const node = nodes.find((item) => item.id === detail.nodeId);
      if (!node) return;

      setSelectedNodeId(detail.nodeId);
      setEdgeContextMenu(null);
      setNodeContextMenu(detail);
    };

    window.addEventListener("workflow:image-context-menu", handleImageContextMenu);
    return () => window.removeEventListener("workflow:image-context-menu", handleImageContextMenu);
  }, [nodes]);

  useEffect(() => {
    const suppressNativeContextMenu = (event: Event) => {
      if (isEditableElement(event.target)) return;
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.closest(".app-shell")) return;
      event.preventDefault();
    };

    window.addEventListener("contextmenu", suppressNativeContextMenu, { capture: true });
    return () => window.removeEventListener("contextmenu", suppressNativeContextMenu, { capture: true });
  }, []);

  const importImageToSelectedNode = useCallback(
    async (file: File) => {
      if (!selectedNodeId || !activeCanvasId) return;
      try {
        const imported = await importImageFileData("import_image_data_url", activeCanvasId, file);
        setNodes((current) =>
          current.map((node) =>
            node.id === selectedNodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    status: "success",
                    imagePath: imported.imagePath,
                    thumbnailPath: imported.thumbnailPath ?? undefined,
                    resultPath: imported.imagePath,
                  },
                }
              : node,
          ),
        );
        appendLogs([`已导入本地图片：${imported.imagePath}`]);
      } catch (error) {
        appendLogs([`导入本地图片失败：${String(error)}`]);
      }
    },
    [activeCanvasId, appendLogs, selectedNodeId, setNodes],
  );

  const pushHistory = useCallback(() => {
    if (isRestoringHistoryRef.current) return;
    historyPastRef.current = [...historyPastRef.current, toSnapshot(nodes, edges)].slice(-60);
    historyFutureRef.current = [];
  }, [edges, nodes]);

  const undo = useCallback(() => {
    const previous = historyPastRef.current.pop();
    if (!previous) return;
    historyFutureRef.current = [toSnapshot(nodes, edges), ...historyFutureRef.current].slice(0, 60);
    isRestoringHistoryRef.current = true;
    applySnapshot(previous);
    isRestoringHistoryRef.current = false;
    appendLogs(["已撤销"]);
  }, [appendLogs, applySnapshot, edges, nodes]);

  const redo = useCallback(() => {
    const next = historyFutureRef.current.shift();
    if (!next) return;
    historyPastRef.current = [...historyPastRef.current, toSnapshot(nodes, edges)].slice(-60);
    isRestoringHistoryRef.current = true;
    applySnapshot(next);
    isRestoringHistoryRef.current = false;
    appendLogs(["已重做"]);
  }, [appendLogs, applySnapshot, edges, nodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowNode>[]) => {
      const hasPositionDragStart = changes.some((change) => change.type === "position" && change.dragging);
      const hasPositionDragEnd = changes.some((change) => change.type === "position" && change.dragging === false);
      const hasStructuralChange = changes.some((change) => change.type === "add" || change.type === "remove");

      if (hasPositionDragStart && !isDraggingNodesRef.current) {
        closeConnectionPicker();
        pushHistory();
        isDraggingNodesRef.current = true;
      }
      if (hasPositionDragStart) setIsDraggingNode(true);
      if (hasStructuralChange) pushHistory();
      if (hasPositionDragEnd) {
        isDraggingNodesRef.current = false;
        setIsDraggingNode(false);
      }

      onNodesChange(changes);
    },
    [closeConnectionPicker, onNodesChange, pushHistory],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<WorkflowEdge>[]) => {
      if (changes.some((change) => change.type === "remove" || change.type === "add")) {
        pushHistory();
      }
      onEdgesChange(changes);
    },
    [onEdgesChange, pushHistory],
  );

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: WorkflowNode[] }) => {
    if (suppressConnectionSelectionRef.current) return;
    if (selectedNodes.length === 0) return;

    closeConnectionPicker();
    setSelectedNodeId(selectedNodes[0].id);
  }, [closeConnectionPicker]);

  const selectNode = useCallback((nodeId: string | null) => {
    closeConnectionPicker();
    suppressConnectionSelectionRef.current = false;
    setSelectedNodeId(nodeId);
  }, [closeConnectionPicker]);

  const handleMoveStart = useCallback((event: MouseEvent | TouchEvent | null) => {
    if (event) closeConnectionPicker();
  }, [closeConnectionPicker]);

  const handleSelectionStart = useCallback(() => {
    closeConnectionPicker();
  }, [closeConnectionPicker]);

  const handlePaneClick = useCallback(() => {
    if (performance.now() < suppressCanvasCloseUntilRef.current) {
      return;
    }

    selectNode(null);
    closeContextMenus();
  }, [closeContextMenus, selectNode]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);
      if (connection.source === connection.target) {
        appendLogs(["连线失败：不允许连接到同一个节点"]);
        return;
      }

      const rule =
        source && target
          ? resolveConnectionRule(
              source.data.kind,
              connection.sourceHandle,
              target.data.kind,
              connection.targetHandle,
            )
          : null;

      if (!rule) {
        appendLogs(["连线失败：该节点端口组合不允许连接"]);
        return;
      }

      pushHistory();
      setNodePickerMenu(null);
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            sourceHandle: rule.sourceHandle,
            targetHandle: rule.targetHandle,
            id: `${connection.source}-${rule.sourceHandle}-${connection.target}-${rule.targetHandle}`,
            data: { dataType: rule.dataType },
          },
          current,
        ),
      );
    },
    [appendLogs, nodes, pushHistory, setEdges],
  );

  const handleConnectStart = useCallback(
    (
      event: MouseEvent | TouchEvent,
      params: { nodeId: string | null; handleId: string | null; handleType: ConnectionHandleType | null },
    ) => {
      const point = clientPointFromEvent(event);
      if (!point || !params.nodeId || !params.handleId || !params.handleType) {
        activeConnectionDragRef.current = null;
        return;
      }

      activeConnectionDragRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        handleType: params.handleType,
        startX: point.x,
        startY: point.y,
      };
      suppressConnectionSelectionRef.current = true;
      if (nodeSettingsDelayRef.current !== null) {
        window.clearTimeout(nodeSettingsDelayRef.current);
        nodeSettingsDelayRef.current = null;
      }
      setNodeSettingsNodeId(null);
      setNodePickerMenu(null);
      setPaneContextMenu(null);
    },
    [],
  );

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { isValid: boolean | null }) => {
      const drag = activeConnectionDragRef.current;
      const point = clientPointFromEvent(event);
      const shouldOpenPicker =
        drag &&
        point &&
        connectionState.isValid !== true &&
        Math.hypot(point.x - drag.startX, point.y - drag.startY) >= CONNECTION_PICKER_MIN_DISTANCE_PX;

      if (shouldOpenPicker) {
        openConnectionPicker(drag, point.x, point.y);
      }

      const didOpenPicker = Boolean(shouldOpenPicker);
      activeConnectionDragRef.current = null;
      if (!didOpenPicker) {
        window.setTimeout(() => {
          suppressConnectionSelectionRef.current = false;
        }, 120);
      }
    },
    [openConnectionPicker],
  );

  const handleAddNode = (kind: WorkflowNodeKind, position?: { x: number; y: number }) => {
    suppressConnectionSelectionRef.current = false;
    pushHistory();
    const nextNode = createNode(kind, nodes.length);
    if (position) nextNode.position = position;
    setNodes((current) => [...current, nextNode]);
    setSelectedNodeId(nextNode.id);
    setPaneContextMenu(null);
    setNodePickerMenu(null);
  };

  const addConnectedNodeFromPicker = useCallback(
    (kind: WorkflowNodeKind, menu: NodePickerMenu) => {
      if (!menu.connectionOrigin) return false;

      const origin = menu.connectionOrigin;
      const originNode = nodes.find((node) => node.id === origin.nodeId);
      if (!originNode) return false;

      const rule =
        origin.handleType === "source"
          ? connectionRules.find(
              (item) =>
                item.sourceKind === originNode.data.kind &&
                item.sourceHandle === origin.handleId &&
                item.targetKind === kind,
            )
          : connectionRules.find(
              (item) =>
                item.sourceKind === kind &&
                item.targetKind === originNode.data.kind &&
                item.targetHandle === origin.handleId,
            );

      if (!rule) return false;

      pushHistory();
      const nextNode = createNode(kind, nodes.length);
      nextNode.position = { x: menu.flowX, y: menu.flowY };
      const edge: Connection = {
        source: origin.handleType === "source" ? origin.nodeId : nextNode.id,
        sourceHandle: rule.sourceHandle,
        target: origin.handleType === "source" ? nextNode.id : origin.nodeId,
        targetHandle: rule.targetHandle,
      };

      setNodes((current) => [...current, nextNode]);
      setEdges((current) =>
        addEdge(
          {
            ...edge,
            id: `${edge.source}-${rule.sourceHandle}-${edge.target}-${rule.targetHandle}`,
            data: { dataType: rule.dataType },
          },
          current,
        ),
      );
      setSelectedNodeId(nextNode.id);
      setNodePickerMenu(null);
      setNodeSettingsNodeId(null);
      window.setTimeout(() => {
        suppressConnectionSelectionRef.current = false;
      }, 320);
      appendLogs([`已添加并连接节点：${nextNode.data.title}`]);
      return true;
    },
    [appendLogs, nodes, pushHistory, setEdges, setNodes],
  );

  const openPaneContextMenu = useCallback(
    (event: ReactMouseEvent | globalThis.MouseEvent) => {
      event.preventDefault();
      const position = flowInstance
        ? flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
        : { x: event.clientX, y: event.clientY };
      suppressConnectionSelectionRef.current = false;
      setSelectedNodeId(null);
      setNodeContextMenu(null);
      setEdgeContextMenu(null);
      setNodePickerMenu(null);
      setPaneContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: position.x,
        flowY: position.y,
      });
    },
    [flowInstance],
  );

  const openNodePickerFromPaneMenu = useCallback(() => {
    if (!paneContextMenu) return;
    setNodePickerMenu(paneContextMenu);
    setPaneContextMenu(null);
  }, [paneContextMenu]);

  const addNodeFromPicker = useCallback(
    (kind: WorkflowNodeKind) => {
      if (nodePickerMenu?.connectionOrigin && addConnectedNodeFromPicker(kind, nodePickerMenu)) return;

      const position = nodePickerMenu ? { x: nodePickerMenu.flowX, y: nodePickerMenu.flowY } : undefined;
      handleAddNode(kind, position);
    },
    [addConnectedNodeFromPicker, handleAddNode, nodePickerMenu],
  );

  const updateSelectedNode = (patch: Partial<WorkflowNodeData>) => {
    if (!selectedNodeId) return;
    pushHistory();
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  };

  const saveProject = useCallback(
    async (project: WorkflowProject, signature: string) => {
      if (isAutoSavingRef.current) {
        pendingAutoSaveRef.current = { project, signature };
        return;
      }

      isAutoSavingRef.current = true;
      let nextSave: ProjectSaveRequest | null = { project, signature };

      while (nextSave) {
        pendingAutoSaveRef.current = null;
        try {
          await invoke("save_workflow_project", { project: nextSave.project });
          lastPersistedProjectSignatureRef.current = nextSave.signature;
        } catch (error) {
          appendLogs([`自动保存失败：${String(error)}`]);
          break;
        }

        const pendingSave = pendingAutoSaveRef.current as ProjectSaveRequest | null;
        nextSave = pendingSave?.signature === lastPersistedProjectSignatureRef.current ? null : pendingSave;
      }

      isAutoSavingRef.current = false;
    },
    [appendLogs],
  );

  useEffect(() => {
    if (!isProjectLoaded || !project) return undefined;

    const snapshot = toPersistableSnapshot(nodes, edges);
    const nextProject = withCanvasSnapshot(project, project.activeCanvasId, snapshot);
    const signature = projectSignature(nextProject);

    if (lastPersistedProjectSignatureRef.current === null) {
      lastPersistedProjectSignatureRef.current = signature;
      return undefined;
    }
    if (signature === lastPersistedProjectSignatureRef.current) return undefined;

    const timeoutId = window.setTimeout(() => {
      void saveProject(nextProject, signature);
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [edges, isProjectLoaded, nodes, project, saveProject]);

  const saveApiConfig = async (nextConfig: ApiConfig) => {
    try {
      await invoke("save_api_config", { config: nextConfig });
      setApiConfig(nextConfig);
      setIsSettingsOpen(false);
      appendLogs(["已保存 AI 配置"]);
    } catch (error) {
      appendLogs([`AI 配置保存失败：${String(error)}`]);
    }
  };

  const cancelActiveRun = async () => {
    if (!activeRun?.runId) {
      appendLogs(["运行已开始，等待后端返回运行 ID 后才能打断"]);
      return;
    }

    const runId = activeRun.runId;
    setActiveRun((current) => (current?.runId === runId ? { ...current, isCancelling: true } : current));
    setNodes((current) =>
      current.map((node) =>
        activeRun.nodeIds.includes(node.id) && ACTIVE_NODE_STATUSES.has(node.data.status)
          ? { ...node, data: { ...node.data, status: "cancelled", error: "已请求打断运行" } }
          : node,
      ),
    );

    try {
      await invoke("cancel_run", { runId });
      appendLogs([`已请求打断运行：${runId}`]);
    } catch (error) {
      setActiveRun((current) => (current?.runId === runId ? { ...current, isCancelling: false } : current));
      appendLogs([`打断运行失败：${String(error)}`]);
    }
  };

  const runNode = async (nodeId: string) => {
    if (!activeCanvasId) return;
    if (activeRun) {
      appendLogs(["已有节点正在运行，请等待结束或先打断当前运行"]);
      return;
    }
    const requestToken = runRequestTokenRef.current + 1;
    runRequestTokenRef.current = requestToken;
    activeRunIdRef.current = null;
    setActiveRun({ runId: null, mode: "node", nodeIds: [nodeId], isCancelling: false });
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, status: "running" } } : node,
      ),
    );
    try {
      const response = await invoke<RunResponse>("run_node", {
        canvasId: activeCanvasId,
        snapshot: toSnapshot(nodes, edges),
        nodeId,
      });
      if (requestToken !== runRequestTokenRef.current) return;
      if (activeRunIdRef.current && response.runId !== activeRunIdRef.current) return;
      activeRunIdRef.current = response.runId;
      applySnapshot(response.snapshot);
      appendLogs(response.logs);
    } catch (error) {
      if (requestToken !== runRequestTokenRef.current) return;
      activeRunIdRef.current = null;
      setActiveRun(null);
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, status: "error", error: String(error) } } : node,
        ),
      );
      appendLogs([`运行失败：${String(error)}`]);
    }
  };

  const runWorkflow = async () => {
    if (!activeCanvasId) return;
    if (activeRun) {
      const shouldCancel = window.confirm("当前已有节点正在运行。要先打断当前运行吗？");
      if (shouldCancel) {
        void cancelActiveRun();
      }
      return;
    }
    const requestToken = runRequestTokenRef.current + 1;
    runRequestTokenRef.current = requestToken;
    activeRunIdRef.current = null;
    setActiveRun({ runId: null, mode: "workflow", nodeIds: nodes.map((node) => node.id), isCancelling: false });
    setNodes((current) =>
      current.map((node) => ({ ...node, data: { ...node.data, status: "queued" } })),
    );
    try {
      const response = await invoke<RunResponse>("run_workflow", {
        canvasId: activeCanvasId,
        snapshot: toSnapshot(nodes, edges),
      });
      if (requestToken !== runRequestTokenRef.current) return;
      if (activeRunIdRef.current && response.runId !== activeRunIdRef.current) return;
      activeRunIdRef.current = response.runId;
      applySnapshot(response.snapshot);
      appendLogs(response.logs);
    } catch (error) {
      if (requestToken !== runRequestTokenRef.current) return;
      activeRunIdRef.current = null;
      setActiveRun(null);
      appendLogs([`工作流运行失败：${String(error)}`]);
    }
  };

  const openImageContextMenu = useCallback(
    (event: ReactMouseEvent, node: WorkflowNode) => {
      const imagePath = nodeResultImagePath(node.data);
      event.preventDefault();
      setSelectedNodeId(node.id);
      setEdgeContextMenu(null);
      setNodeContextMenu({
        nodeId: node.id,
        imagePath,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  const openEdgeContextMenu = useCallback((event: ReactMouseEvent, edge: WorkflowEdge) => {
    event.preventDefault();
    setSelectedNodeId(null);
    setNodeContextMenu(null);
    setEdgeContextMenu({
      edgeId: edge.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const deleteNode = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId);
    pushHistory();
    setNodes((current) => current.filter((item) => item.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId((current) => (current === nodeId ? null : current));
    setNodeContextMenu(null);
    appendLogs([`已删除节点：${node?.data.title ?? nodeId}`]);
  };

  const deleteContextNode = () => {
    if (!nodeContextMenu) return;
    deleteNode(nodeContextMenu.nodeId);
  };

  const deleteEdge = (edgeId: string) => {
    pushHistory();
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    setEdgeContextMenu(null);
    appendLogs([`已删除连线：${edgeId}`]);
  };

  const deleteContextEdge = () => {
    if (!edgeContextMenu) return;
    deleteEdge(edgeContextMenu.edgeId);
  };

  const saveContextImage = async () => {
    if (!nodeContextMenu?.imagePath) return;
    try {
      const destinationPath = await save({
        defaultPath: defaultImageFileName(nodeContextMenu.imagePath),
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (!destinationPath) return;
      const savedPath = await invoke<string>("save_image_as", {
        imagePath: nodeContextMenu.imagePath,
        destinationPath,
      });
      appendLogs([`已保存图片：${savedPath}`]);
    } catch (error) {
      appendLogs([`保存图片失败：${String(error)}`]);
    } finally {
      setNodeContextMenu(null);
    }
  };

  const copyContextImage = async () => {
    if (!nodeContextMenu?.imagePath) return;
    try {
      await invoke("copy_image_to_clipboard", { imagePath: nodeContextMenu.imagePath });
      appendLogs(["已复制图片到剪切板"]);
    } catch (error) {
      appendLogs([`复制图片失败：${String(error)}`]);
    } finally {
      setNodeContextMenu(null);
    }
  };

  const showContextImageInFolder = async () => {
    if (!nodeContextMenu?.imagePath) return;
    try {
      await invoke("show_in_folder", { imagePath: nodeContextMenu.imagePath });
      appendLogs(["已打开图片所在文件夹"]);
    } catch (error) {
      appendLogs([`打开文件夹失败：${String(error)}`]);
    } finally {
      setNodeContextMenu(null);
    }
  };

  const rerunContextNode = () => {
    if (!nodeContextMenu) return;
    if (activeRun) {
      appendLogs(["已有节点正在运行，不能重新运行其他节点"]);
      return;
    }
    const nodeId = nodeContextMenu.nodeId;
    setNodeContextMenu(null);
    runNode(nodeId);
  };

  const deleteSelectedItems = useCallback(() => {
    const selectedNodeIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    const selectedEdgeIds = new Set(edges.filter((edge) => edge.selected).map((edge) => edge.id));
    if (selectedNodeId) selectedNodeIds.add(selectedNodeId);
    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    pushHistory();
    setNodes((current) => current.filter((node) => !selectedNodeIds.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target),
      ),
    );
    setSelectedNodeId(null);
    appendLogs(["已删除选中内容"]);
  }, [appendLogs, edges, nodes, pushHistory, selectedNodeId, setEdges, setNodes]);

  const copySelectedItems = useCallback(() => {
    const selectedNodeIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    if (selectedNodeId) selectedNodeIds.add(selectedNodeId);
    const selectedNodes = nodes.filter((node) => selectedNodeIds.has(node.id));
    if (selectedNodes.length === 0) return;

    clipboardRef.current = {
      nodes: selectedNodes,
      edges: edges.filter((edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)),
    };
    appendLogs([`已复制 ${selectedNodes.length} 个节点`]);
  }, [appendLogs, edges, nodes, selectedNodeId]);

  const pasteItems = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.nodes.length === 0) return;

    pushHistory();
    const idMap = new Map<string, string>();
    const createdAt = Date.now();
    const minX = Math.min(...clipboard.nodes.map((node) => node.position.x));
    const minY = Math.min(...clipboard.nodes.map((node) => node.position.y));
    const offset = 42;
    const nextNodes = clipboard.nodes.map((node, index) => {
      const nextId = `${node.data.kind}-${createdAt}-${index}`;
      idMap.set(node.id, nextId);
      return {
        ...node,
        id: nextId,
        selected: true,
        position: {
          x: node.position.x - minX + minX + offset,
          y: node.position.y - minY + minY + offset,
        },
        data: { ...node.data, title: `${node.data.title} 副本` },
      };
    });
    const nextEdges: WorkflowEdge[] = [];
    clipboard.edges.forEach((edge, index) => {
      const source = idMap.get(edge.source);
      const target = idMap.get(edge.target);
      if (source && target) {
        nextEdges.push({
          ...edge,
          id: `${source}-${edge.sourceHandle}-${target}-${edge.targetHandle}-${index}`,
          source,
          target,
          selected: false,
        });
      }
    });

    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...nextNodes,
    ]);
    setEdges((current) => [...current.map((edge) => ({ ...edge, selected: false })), ...nextEdges]);
    setSelectedNodeId(nextNodes[0]?.id ?? null);
    appendLogs([`已粘贴 ${nextNodes.length} 个节点`]);
  }, [appendLogs, pushHistory, setEdges, setNodes]);

  const autoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();
    const depthByNode = new Map(nodes.map((node) => [node.id, 0]));
    for (let pass = 0; pass < nodes.length; pass += 1) {
      for (const edge of edges) {
        const sourceDepth = depthByNode.get(edge.source) ?? 0;
        const targetDepth = depthByNode.get(edge.target) ?? 0;
        if (targetDepth <= sourceDepth) depthByNode.set(edge.target, sourceDepth + 1);
      }
    }
    const rowByDepth = new Map<number, number>();
    setNodes((current) =>
      current.map((node) => {
        const depth = depthByNode.get(node.id) ?? 0;
        const row = rowByDepth.get(depth) ?? 0;
        rowByDepth.set(depth, row + 1);
        return {
          ...node,
          position: { x: 80 + depth * 310, y: 80 + row * 210 },
        };
      }),
    );
    window.requestAnimationFrame(() => flowInstance?.fitView({ padding: 0.18, duration: 280 }));
    appendLogs(["已自动布局"]);
  }, [appendLogs, edges, flowInstance, nodes, pushHistory, setNodes]);

  const groupSelectedItems = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected && node.data.kind !== "group" && !node.parentId);
    if (selectedNodes.length < 2) return;

    pushHistory();
    const minX = Math.min(...selectedNodes.map((node) => node.position.x));
    const minY = Math.min(...selectedNodes.map((node) => node.position.y));
    const maxX = Math.max(...selectedNodes.map((node) => node.position.x + (node.measured?.width ?? 220)));
    const maxY = Math.max(...selectedNodes.map((node) => node.position.y + (node.measured?.height ?? 150)));
    const groupId = `group-${Date.now()}`;
    const groupPosition = { x: minX - 44, y: minY - 74 };
    const groupWidth = Math.max(320, maxX - minX + 88);
    const groupHeight = Math.max(220, maxY - minY + 118);
    const selectedIds = new Set(selectedNodes.map((node) => node.id));
    const groupNode: WorkflowNode = {
      id: groupId,
      type: "workflowNode",
      position: groupPosition,
      style: { width: groupWidth, height: groupHeight },
      data: {
        kind: "group",
        title: "节点分组",
        status: "idle",
        groupWidth,
        groupHeight,
      },
    };

    setNodes((current) => [
      groupNode,
      ...current.map((node) =>
        selectedIds.has(node.id)
          ? {
              ...node,
              parentId: groupId,
              extent: "parent" as const,
              selected: false,
              position: {
                x: node.position.x - groupPosition.x,
                y: node.position.y - groupPosition.y,
              },
            }
          : node,
      ),
    ]);
    setSelectedNodeId(groupId);
    appendLogs([`已分组 ${selectedNodes.length} 个节点`]);
  }, [appendLogs, nodes, pushHistory, setNodes]);

  const ungroupSelectedItems = useCallback(() => {
    const groupIds = new Set(
      nodes
        .filter((node) => node.selected && node.data.kind === "group")
        .map((node) => node.id),
    );
    if (selectedNodeId) {
      const selectedNode = nodes.find((node) => node.id === selectedNodeId);
      if (selectedNode?.data.kind === "group") groupIds.add(selectedNode.id);
    }
    if (groupIds.size === 0) return;

    pushHistory();
    const groupPositions = new Map(
      nodes
        .filter((node) => groupIds.has(node.id))
        .map((node) => [node.id, node.position]),
    );
    setNodes((current) =>
      current
        .filter((node) => !groupIds.has(node.id))
        .map((node) => {
          if (!node.parentId || !groupIds.has(node.parentId)) return node;
          const parentPosition = groupPositions.get(node.parentId) ?? { x: 0, y: 0 };
          return {
            ...node,
            parentId: undefined,
            extent: undefined,
            selected: true,
            position: {
              x: parentPosition.x + node.position.x,
              y: parentPosition.y + node.position.y,
            },
          };
        }),
    );
    setSelectedNodeId(null);
    appendLogs([`已取消 ${groupIds.size} 个分组`]);
  }, [appendLogs, nodes, pushHistory, selectedNodeId, setNodes]);

  const fitAll = useCallback(() => {
    flowInstance?.fitView({ padding: 0.18, duration: 240 });
  }, [flowInstance]);

  const fitSelected = useCallback(() => {
    const selected = nodes.filter((node) => node.selected || node.id === selectedNodeId);
    if (selected.length === 0) {
      fitAll();
      return;
    }
    flowInstance?.fitView({ nodes: selected, padding: 0.28, duration: 240 });
  }, [fitAll, flowInstance, nodes, selectedNodeId]);

  const resetView = useCallback(() => {
    flowInstance?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 240 });
  }, [flowInstance]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElement(event.target)) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedItems();
        return;
      }
      if (mod && key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (mod && key === "c") {
        event.preventDefault();
        copySelectedItems();
        return;
      }
      if (mod && key === "v") {
        event.preventDefault();
        pasteItems();
        return;
      }
      if (mod && event.shiftKey && key === "g") {
        event.preventDefault();
        ungroupSelectedItems();
        return;
      }
      if (mod && key === "g") {
        event.preventDefault();
        groupSelectedItems();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        fitSelected();
        return;
      }
      if (key === "0") {
        event.preventDefault();
        resetView();
        return;
      }
      if (key === "l") {
        event.preventDefault();
        autoLayout();
        return;
      }
      if (event.key === "Enter" && mod) {
        event.preventDefault();
        if (selectedNodeId) {
          void runNode(selectedNodeId);
        } else {
          void runWorkflow();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    autoLayout,
    copySelectedItems,
    deleteSelectedItems,
    fitSelected,
    groupSelectedItems,
    pasteItems,
    redo,
    resetView,
    selectedNodeId,
    ungroupSelectedItems,
    undo,
  ]);


  const isValidConnection = useCallback(
    (connection: Connection | WorkflowEdge) => {
      if (connection.source === connection.target) return false;
      const source = nodes.find((node) => node.id === connection.source);
      const target = nodes.find((node) => node.id === connection.target);
      if (!source || !target) return false;
      return Boolean(
        resolveConnectionRule(
          source.data.kind,
          connection.sourceHandle ?? null,
          target.data.kind,
          connection.targetHandle ?? null,
        ),
      );
    },
    [nodes],
  );

  const createCanvas = useCallback(() => {
    if (activeRun || !project) {
      if (activeRun) appendLogs(["运行中不能切换或创建画布"]);
      return;
    }

    const currentSnapshot = toPersistableSnapshot(nodes, edges);
    const baseProject = withCanvasSnapshot(project, project.activeCanvasId, currentSnapshot);
    const nextCanvas = createBlankCanvas(baseProject.canvases.length + 1);
    const nextProject = {
      ...baseProject,
      activeCanvasId: nextCanvas.id,
      canvases: [...baseProject.canvases, nextCanvas],
    };

    historyPastRef.current = [];
    historyFutureRef.current = [];
    setProject(nextProject);
    applySnapshot(nextCanvas.snapshot);
    appendLogs([`已创建画布：${nextCanvas.name}`]);
  }, [activeRun, appendLogs, applySnapshot, edges, nodes, project]);

  const switchCanvas = useCallback(
    (canvasId: string) => {
      if (!project || canvasId === project.activeCanvasId) return;
      if (activeRun) {
        appendLogs(["运行中不能切换画布"]);
        return;
      }

      const currentSnapshot = toPersistableSnapshot(nodes, edges);
      const baseProject = withCanvasSnapshot(project, project.activeCanvasId, currentSnapshot);
      const targetCanvas = baseProject.canvases.find((canvas) => canvas.id === canvasId);
      if (!targetCanvas) return;

      historyPastRef.current = [];
      historyFutureRef.current = [];
      setProject({ ...baseProject, activeCanvasId: canvasId });
      applySnapshot(targetCanvas.snapshot);
      closeContextMenus();
      appendLogs([`已切换到画布：${targetCanvas.name}`]);
    },
    [activeRun, appendLogs, applySnapshot, closeContextMenus, edges, nodes, project],
  );

  const chooseAssetRootDir = useCallback(async () => {
    if (!project) return;
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;

    const currentSnapshot = toPersistableSnapshot(nodes, edges);
    const nextProject = {
      ...withCanvasSnapshot(project, project.activeCanvasId, currentSnapshot),
      assetRootDir: selected,
    };
    setProject(nextProject);
    appendLogs([`已设置画布资源根目录：${selected}`]);
  }, [appendLogs, edges, nodes, project]);

  const resetAssetRootDir = useCallback(() => {
    if (!project) return;
    const currentSnapshot = toPersistableSnapshot(nodes, edges);
    setProject({
      ...withCanvasSnapshot(project, project.activeCanvasId, currentSnapshot),
      assetRootDir: null,
    });
    appendLogs(["已恢复默认画布资源根目录"]);
  }, [appendLogs, edges, nodes, project]);

  const renameCanvas = useCallback(
    async (canvasId: string) => {
      if (!project) return;
      const canvas = project.canvases.find((item) => item.id === canvasId);
      if (!canvas) return;

      const nextName = window.prompt("重命名画布", canvas.name)?.trim();
      if (!nextName || nextName === canvas.name) return;

      const currentSnapshot = toPersistableSnapshot(nodes, edges);
      const baseProject = withCanvasSnapshot(project, project.activeCanvasId, currentSnapshot);

      try {
        const assetDirName = await invoke<string>("rename_canvas_assets_dir", {
          project: baseProject,
          canvasId,
          nextName,
        });
        setProject({
          ...baseProject,
          canvases: baseProject.canvases.map((item) =>
            item.id === canvasId
              ? {
                  ...item,
                  name: nextName,
                  assetDirName,
                }
              : item,
          ),
        });
        appendLogs([`已重命名画布：${nextName}`]);
      } catch (error) {
        appendLogs([`重命名画布失败：${String(error)}`]);
      }
    },
    [appendLogs, edges, nodes, project],
  );

  const deleteCanvas = useCallback(
    async (canvasId: string) => {
      if (!project) return;
      const canvas = project.canvases.find((item) => item.id === canvasId);
      if (!canvas) return;
      if (project.canvases.length <= 1) {
        appendLogs(["至少保留一个画布"]);
        return;
      }

      const shouldDeleteAssets = window.confirm(
        "需要同时删除目录资源？\n确定：删除画布并删除对应目录资源。\n取消：只删除画布，保留目录资源。",
      );
      const currentSnapshot = toPersistableSnapshot(nodes, edges);
      const baseProject = withCanvasSnapshot(project, project.activeCanvasId, currentSnapshot);

      try {
        if (shouldDeleteAssets) {
          await invoke("delete_canvas_assets_dir", {
            project: baseProject,
            canvasId,
          });
        }

        const nextCanvases = baseProject.canvases.filter((item) => item.id !== canvasId);
        const nextActiveCanvasId =
          baseProject.activeCanvasId === canvasId ? nextCanvases[0].id : baseProject.activeCanvasId;
        const nextCanvas = nextCanvases.find((item) => item.id === nextActiveCanvasId) ?? nextCanvases[0];
        const nextProject = {
          ...baseProject,
          activeCanvasId: nextActiveCanvasId,
          canvases: nextCanvases,
        };

        historyPastRef.current = [];
        historyFutureRef.current = [];
        setProject(nextProject);
        if (baseProject.activeCanvasId === canvasId) {
          applySnapshot(nextCanvas.snapshot);
        }
        appendLogs([`已删除画布：${canvas.name}`]);
      } catch (error) {
        appendLogs([`删除画布失败：${String(error)}`]);
      }
    },
    [appendLogs, applySnapshot, edges, nodes, project],
  );

  const openCanvasAssetDir = useCallback(
    async (canvasId: string) => {
      if (!project) return;
      const currentSnapshot = toPersistableSnapshot(nodes, edges);
      const baseProject = withCanvasSnapshot(project, project.activeCanvasId, currentSnapshot);

      try {
        await invoke("open_canvas_assets_dir", {
          project: baseProject,
          canvasId,
        });
      } catch (error) {
        appendLogs([`打开画布目录失败：${String(error)}`]);
      }
    },
    [appendLogs, edges, nodes, project],
  );

  return {
    project,
    canvases: project?.canvases ?? [],
    activeCanvas,
    activeCanvasId,
    assetRootDir: project?.assetRootDir ?? null,
    nodes,
    edges,
    nodeTypes,
    selectedNode,
    nodeSettingsNode,
    apiConfig,
    toasts,
    isSettingsOpen,
    nodeContextMenu,
    edgeContextMenu,
    paneContextMenu,
    nodePickerMenu,
    isRunActive,
    canCancelRun,
    selectedNodeCanCancelRun,
    isCancellingRun: activeRun?.isCancelling ?? false,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleConnectStart,
    handleConnectEnd,
    isValidConnection,
    handleFlowInit,
    handleViewportChange,
    handleMoveStart,
    handleSelectionChange,
    handleSelectionStart,
    handlePaneClick,
    closeContextMenus,
    handleAddNode,
    runWorkflow,
    cancelActiveRun,
    updateSelectedNode,
    importImageToSelectedNode,
    saveApiConfig,
    openImageContextMenu,
    openEdgeContextMenu,
    openPaneContextMenu,
    openNodePickerFromPaneMenu,
    addNodeFromPicker,
    saveContextImage,
    copyContextImage,
    showContextImageInFolder,
    rerunContextNode,
    deleteContextNode,
    deleteContextEdge,
    openSettings: () => setIsSettingsOpen(true),
    closeSettings: () => setIsSettingsOpen(false),
    selectNode,
    runNode,
    fitSelected,
    fitAll,
    autoLayout,
    createCanvas,
    switchCanvas,
    chooseAssetRootDir,
    resetAssetRootDir,
    renameCanvas,
    deleteCanvas,
    openCanvasAssetDir,
    hasSavedViewport: Boolean(initialUiStateRef.current.viewport),
  };
}


function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function clientPointFromEvent(event: MouseEvent | PointerEvent | TouchEvent) {
  if ("touches" in event) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  return { x: event.clientX, y: event.clientY };
}

function previewTextForLog(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 48) return normalized || "空文本";
  return `${normalized.slice(0, 48)}...`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取剪切板图片失败"));
    reader.readAsDataURL(file);
  });
}

async function importImageFileData(commandName: string, canvasId: string, file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const thumbnailDataUrl = await createThumbnailDataUrl(file);
  return invoke<ImportedImage>(commandName, { canvasId, dataUrl, thumbnailDataUrl });
}

function nodeResultImagePath(data: WorkflowNodeData) {
  if (data.kind === "output") return data.lastOutputPath;
  return data.resultPath || data.imagePath;
}

function createThumbnailDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxSize = 420;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("无法创建缩略图"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("读取图片缩略图失败"));
    };
    image.src = objectUrl;
  });
}

function defaultImageFileName(imagePath: string) {
  const name = imagePath.split(/[\\/]/).pop();
  if (name && name.includes(".")) return name;
  return "workflow-image.png";
}

function projectSignature(project: WorkflowProject) {
  return JSON.stringify(project);
}

function currentCanvas(project: WorkflowProject): WorkflowCanvas {
  return project.canvases.find((canvas) => canvas.id === project.activeCanvasId) ?? project.canvases[0] ?? createBlankCanvas(1);
}

function normalizeProject(project: WorkflowProject): WorkflowProject {
  if (project.canvases.length === 0) {
    const canvas = createBlankCanvas(1);
    return {
      activeCanvasId: canvas.id,
      assetRootDir: project.assetRootDir ?? null,
      canvases: [canvas],
    };
  }

  const canvases = project.canvases.map((canvas, index) => ({
    ...canvas,
    id: canvas.id || `canvas-${index + 1}`,
    name: canvas.name || `画布 ${index + 1}`,
    assetDirName: canvas.assetDirName || canvas.id || `canvas-${index + 1}`,
    snapshot: canvas.snapshot ?? { nodes: [], edges: [] },
  }));
  const activeCanvasId = canvases.some((canvas) => canvas.id === project.activeCanvasId)
    ? project.activeCanvasId
    : canvases[0].id;

  return {
    activeCanvasId,
    assetRootDir: project.assetRootDir ?? null,
    canvases,
  };
}

function withCanvasSnapshot(
  project: WorkflowProject,
  canvasId: string,
  snapshot: WorkflowSnapshot,
): WorkflowProject {
  return {
    ...project,
    canvases: project.canvases.map((canvas) =>
      canvas.id === canvasId
        ? {
            ...canvas,
            snapshot,
          }
        : canvas,
    ),
  };
}

function createBlankCanvas(index: number): WorkflowCanvas {
  const createdAt = Date.now();
  const id = `canvas-${createdAt}`;
  return {
    id,
    name: `画布 ${index}`,
    assetDirName: id,
    snapshot: {
      nodes: [],
      edges: [],
    },
  };
}
