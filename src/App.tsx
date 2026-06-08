import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Background,
  Connection,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowInstance,
  ReactFlowProvider,
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
import { fromSnapshot, inputType, outputType, toSnapshot } from "./lib/workflowGraph";
import { ProviderConfig } from "./types/provider";
import {
  RunResponse,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowSnapshot,
} from "./types/workflow";
import "./App.css";

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0].id);
  const [logs, setLogs] = useState<string[]>(["工作流已就绪"]);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>(defaultProviderConfigs);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowNode, WorkflowEdge> | null>(null);

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
    const handlePaste = async (event: ClipboardEvent) => {
      if (isEditableElement(event.target)) return;

      const imageFile = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();
      if (!imageFile) return;

      event.preventDefault();

      try {
        const dataUrl = await readFileAsDataUrl(imageFile);
        const imagePath = await invoke<string>("import_clipboard_image", { dataUrl });
        const node = createNode("imageInput", nodes.length);
        const position = flowInstance
          ? flowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
          : node.position;

        node.position = position;
        node.data = {
          ...node.data,
          title: "粘贴图片",
          status: "success",
          imagePath,
          resultPath: imagePath,
        };
        setNodes((current) => [...current, node]);
        setSelectedNodeId(node.id);
        appendLogs([`已从剪切板导入图片：${imagePath}`]);
      } catch (error) {
        appendLogs([`剪切板图片导入失败：${String(error)}`]);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [appendLogs, flowInstance, nodes.length, setNodes]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      const source = nodes.find((node) => node.id === connection.source);
      const sourceDataType = source ? outputType(source.data.kind) : null;
      const targetDataType = inputType(connection.targetHandle);

      if (!sourceDataType || sourceDataType !== targetDataType) {
        appendLogs(["连线失败：端口类型不匹配"]);
        return;
      }

      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
            data: { dataType: sourceDataType },
          },
          current,
        ),
      );
    },
    [appendLogs, nodes, setEdges],
  );

  const handleAddNode = (kind: WorkflowNodeKind) => {
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
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
  };

  const saveWorkflow = async () => {
    try {
      await invoke("save_workflow", { snapshot: toSnapshot(nodes, edges) });
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
      applySnapshot(response.snapshot);
      appendLogs(response.logs);
    } catch (error) {
      updateSelectedNode({ status: "error", error: String(error) });
      appendLogs([`运行失败：${String(error)}`]);
    }
  };

  const runWorkflow = async () => {
    setNodes((current) =>
      current.map((node) => ({ ...node, data: { ...node.data, status: "queued" } })),
    );
    try {
      const response = await invoke<RunResponse>("run_workflow", {
        snapshot: toSnapshot(nodes, edges),
      });
      applySnapshot(response.snapshot);
      appendLogs(response.logs);
    } catch (error) {
      appendLogs([`工作流运行失败：${String(error)}`]);
    }
  };

  return (
    <ReactFlowProvider>
      <main className="app-shell">
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
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onInit={setFlowInstance}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
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
            onRun={() => selectedNode && runNode(selectedNode.id)}
          />
        </aside>

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

export default App;
