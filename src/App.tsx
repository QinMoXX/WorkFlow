import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import {
  Background,
  Connection,
  Controls,
  EdgeChange,
  MiniMap,
  NodeChange,
  ReactFlow,
  ReactFlowInstance,
  ReactFlowProvider,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AiSettingsPanel } from "./components/AiSettingsPanel";
import { NodeLibrary } from "./components/NodeLibrary";
import { PropertyPanel } from "./components/PropertyPanel";
import { RunLogPanel } from "./components/RunLogPanel";
import { WorkflowNodeCard } from "./components/WorkflowNodeCard";
import { createNode, initialEdges, initialNodes } from "./lib/nodeCatalog";
import { defaultProviderConfigs, firstProviderPreset } from "./lib/providerPresets";
import { findConnectionRule, fromSnapshot, toPersistableSnapshot, toSnapshot } from "./lib/workflowGraph";
import { ProviderConfig } from "./types/provider";
import {
  RunResponse,
  ImportedImage,
  RunFinishedEvent,
  RunLogEvent,
  RunNodeEvent,
  RunStartedEvent,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowSnapshot,
} from "./types/workflow";
import "./App.css";

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

type ClipboardGraph = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0].id);
  const [logs, setLogs] = useState<string[]>(["工作流已就绪"]);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenu | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenu | null>(null);
  const [providers, setProviders] = useState<ProviderConfig[]>(defaultProviderConfigs);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowNode, WorkflowEdge> | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const runRequestTokenRef = useRef(0);
  const latestRunSequenceByRunIdRef = useRef(new Map<string, number>());
  const historyPastRef = useRef<WorkflowSnapshot[]>([]);
  const historyFutureRef = useRef<WorkflowSnapshot[]>([]);
  const isRestoringHistoryRef = useRef(false);
  const isDraggingNodesRef = useRef(false);
  const clipboardRef = useRef<ClipboardGraph | null>(null);

  const nodeTypes = useMemo(() => ({ workflowNode: WorkflowNodeCard }), []);
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const appendLogs = useCallback((nextLogs: string[]) => {
    setLogs((current) => [...nextLogs, ...current].slice(0, 80));
  }, []);

  const applySnapshot = useCallback(
    (snapshot: WorkflowSnapshot) => {
      const next = fromSnapshot(snapshot);
      setNodes(next.nodes);
      setEdges(next.edges);
      setSelectedNodeId((current) => {
        if (current && next.nodes.some((node) => node.id === current)) return current;
        return next.nodes[0]?.id ?? null;
      });
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    invoke<WorkflowSnapshot | null>("load_workflow")
      .then((snapshot) => {
        if (snapshot) {
          applySnapshot(snapshot);
          appendLogs(["已恢复上次工作流"]);
        }
      })
      .catch((error) => appendLogs([`加载失败：${String(error)}`]));
  }, [appendLogs, applySnapshot]);

  useEffect(() => {
    invoke<ProviderConfig[]>("load_provider_configs")
      .then((configs) => {
        if (configs.length > 0) {
          setProviders(configs);
          appendLogs(["已加载 AI 配置"]);
        }
      })
      .catch((error) => appendLogs([`AI 配置加载失败：${String(error)}`]));
  }, [appendLogs]);

  useEffect(() => {
    const unlisteners = [
      listen<RunStartedEvent>("workflow://run/started", (event) => {
        activeRunIdRef.current = event.payload.runId;
        latestRunSequenceByRunIdRef.current.set(event.payload.runId, 0);
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
        appendLogs([
          `运行结束：成功 ${summary.success}，失败 ${summary.error}，阻塞 ${summary.blocked}，跳过 ${summary.skipped}`,
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

      const imageFile = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();
      if (!imageFile) return;

      event.preventDefault();

      try {
        const imported = await importImageFileData("import_clipboard_image", imageFile);
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
      } catch (error) {
        appendLogs([`剪切板图片导入失败：${String(error)}`]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [appendLogs, flowInstance, nodes.length, setNodes]);

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
      if (!selectedNodeId) return;
      try {
        const imported = await importImageFileData("import_image_data_url", file);
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
    [appendLogs, selectedNodeId, setNodes],
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
        pushHistory();
        isDraggingNodesRef.current = true;
      }
      if (hasStructuralChange) pushHistory();
      if (hasPositionDragEnd) isDraggingNodesRef.current = false;

      onNodesChange(changes);
    },
    [onNodesChange, pushHistory],
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
          ? findConnectionRule(
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
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
            data: { dataType: rule.dataType },
          },
          current,
        ),
      );
    },
    [appendLogs, nodes, pushHistory, setEdges],
  );

  const handleAddNode = (kind: WorkflowNodeKind) => {
    pushHistory();
    const nextNode = createNode(kind, nodes.length);
    if (kind === "textToImage") {
      const preset = firstProviderPreset(providers, "textToImage");
      if (preset) nextNode.data = { ...nextNode.data, ...preset };
    }
    if (kind === "imageToImage") {
      const preset = firstProviderPreset(providers, "imageToImage");
      if (preset) nextNode.data = { ...nextNode.data, ...preset };
    }
    setNodes((current) => [...current, nextNode]);
    setSelectedNodeId(nextNode.id);
  };

  const updateSelectedNode = (patch: Partial<WorkflowNodeData>) => {
    if (!selectedNodeId) return;
    pushHistory();
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  };

  const saveWorkflow = async () => {
    try {
      await invoke("save_workflow", { snapshot: toPersistableSnapshot(nodes, edges) });
      appendLogs(["已保存当前工作流"]);
    } catch (error) {
      appendLogs([`保存失败：${String(error)}`]);
    }
  };

  const saveProviderConfigs = async (nextProviders: ProviderConfig[]) => {
    try {
      await invoke("save_provider_configs", { providers: nextProviders });
      setProviders(nextProviders);
      setIsSettingsOpen(false);
      appendLogs(["已保存 AI 配置"]);
    } catch (error) {
      appendLogs([`AI 配置保存失败：${String(error)}`]);
    }
  };

  const runNode = async (nodeId: string) => {
    const requestToken = runRequestTokenRef.current + 1;
    runRequestTokenRef.current = requestToken;
    activeRunIdRef.current = null;
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, status: "running" } } : node,
      ),
    );
    try {
      const response = await invoke<RunResponse>("run_node", {
        snapshot: toSnapshot(nodes, edges),
        nodeId,
      });
      if (requestToken !== runRequestTokenRef.current) return;
      if (activeRunIdRef.current && response.runId !== activeRunIdRef.current) return;
      activeRunIdRef.current = response.runId;
      applySnapshot(response.snapshot);
      appendLogs(response.logs);
    } catch (error) {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, status: "error", error: String(error) } } : node,
        ),
      );
      appendLogs([`运行失败：${String(error)}`]);
    }
  };

  const runWorkflow = async () => {
    const requestToken = runRequestTokenRef.current + 1;
    runRequestTokenRef.current = requestToken;
    activeRunIdRef.current = null;
    setNodes((current) =>
      current.map((node) => ({ ...node, data: { ...node.data, status: "queued" } })),
    );
    try {
      const response = await invoke<RunResponse>("run_workflow", {
        snapshot: toSnapshot(nodes, edges),
      });
      if (requestToken !== runRequestTokenRef.current) return;
      if (activeRunIdRef.current && response.runId !== activeRunIdRef.current) return;
      activeRunIdRef.current = response.runId;
      applySnapshot(response.snapshot);
      appendLogs(response.logs);
    } catch (error) {
      appendLogs([`工作流运行失败：${String(error)}`]);
    }
  };

  const openImageContextMenu = useCallback(
    (event: MouseEvent, node: WorkflowNode) => {
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

  const openEdgeContextMenu = useCallback((event: MouseEvent, edge: WorkflowEdge) => {
    event.preventDefault();
    setSelectedNodeId(null);
    setNodeContextMenu(null);
    setEdgeContextMenu({
      edgeId: edge.id,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const closeContextMenus = () => {
    setNodeContextMenu(null);
    setEdgeContextMenu(null);
  };

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
      if (mod && key === "s") {
        event.preventDefault();
        void saveWorkflow();
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

  return (
    <ReactFlowProvider>
      <main className="app-shell" onClick={closeContextMenus}>
        <NodeLibrary
          onAddNode={handleAddNode}
          onRunWorkflow={runWorkflow}
          onSaveWorkflow={saveWorkflow}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <section className="canvas-panel">
          <ReactFlow<WorkflowNode, WorkflowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            isValidConnection={(connection) => {
              if (connection.source === connection.target) return false;
              const source = nodes.find((node) => node.id === connection.source);
              const target = nodes.find((node) => node.id === connection.target);
              if (!source || !target) return false;
              return Boolean(
                findConnectionRule(
                  source.data.kind,
                  connection.sourceHandle,
                  target.data.kind,
                  connection.targetHandle,
                ),
              );
            }}
            onInit={setFlowInstance}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onNodeContextMenu={openImageContextMenu}
            onEdgeContextMenu={openEdgeContextMenu}
            onPaneClick={() => {
              setSelectedNodeId(null);
              closeContextMenus();
            }}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode={["Control", "Meta", "Shift"]}
            deleteKeyCode={null}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </section>

        <aside className="properties-panel">
          <PropertyPanel
            node={selectedNode}
            providers={providers}
            onChange={updateSelectedNode}
            onImportImage={importImageToSelectedNode}
            onRun={() => selectedNode && runNode(selectedNode.id)}
          />
        </aside>

        {nodeContextMenu && (
          <div
            className="image-context-menu"
            style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={saveContextImage} disabled={!nodeContextMenu.imagePath}>
              保存图片
            </button>
            <button type="button" onClick={copyContextImage} disabled={!nodeContextMenu.imagePath}>
              复制图片
            </button>
            <button type="button" onClick={showContextImageInFolder} disabled={!nodeContextMenu.imagePath}>
              在文件夹中显示
            </button>
            <button type="button" onClick={rerunContextNode}>
              重新运行该节点
            </button>
            <button type="button" className="danger-menu-item" onClick={deleteContextNode}>
              删除节点
            </button>
          </div>
        )}

        {edgeContextMenu && (
          <div
            className="image-context-menu"
            style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="danger-menu-item" onClick={deleteContextEdge}>
              删除连线
            </button>
          </div>
        )}

        <RunLogPanel logs={logs} isOpen={isLogOpen} onToggle={() => setIsLogOpen((value) => !value)} />
        <AiSettingsPanel
          isOpen={isSettingsOpen}
          providers={providers}
          onClose={() => setIsSettingsOpen(false)}
          onSave={saveProviderConfigs}
        />
      </main>
    </ReactFlowProvider>
  );
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取剪切板图片失败"));
    reader.readAsDataURL(file);
  });
}

async function importImageFileData(commandName: string, file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const thumbnailDataUrl = await createThumbnailDataUrl(file);
  return invoke<ImportedImage>(commandName, { dataUrl, thumbnailDataUrl });
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

function nodeResultImagePath(data: WorkflowNodeData) {
  if (data.kind === "output") return data.lastOutputPath;
  return data.resultPath || data.imagePath;
}

function defaultImageFileName(imagePath: string) {
  const name = imagePath.split(/[\\/]/).pop();
  if (name && name.includes(".")) return name;
  return "workflow-image.png";
}

export default App;
