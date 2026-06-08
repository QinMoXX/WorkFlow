import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
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
import { findConnectionRule, fromSnapshot, toSnapshot } from "./lib/workflowGraph";
import { ProviderConfig } from "./types/provider";
import {
  RunResponse,
  ImportedImage,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeKind,
  WorkflowSnapshot,
} from "./types/workflow";
import "./App.css";

type ImageContextMenu = {
  nodeId: string;
  imagePath: string;
  x: number;
  y: number;
};

type ImageContextMenuDetail = ImageContextMenu;

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0].id);
  const [logs, setLogs] = useState<string[]>(["工作流已就绪"]);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [imageContextMenu, setImageContextMenu] = useState<ImageContextMenu | null>(null);
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
      const detail = (event as CustomEvent<ImageContextMenuDetail>).detail;
      const node = nodes.find((item) => item.id === detail.nodeId);
      if (!node) return;

      setSelectedNodeId(detail.nodeId);
      setImageContextMenu(detail);
    };

    window.addEventListener("workflow:image-context-menu", handleImageContextMenu);
    return () => window.removeEventListener("workflow:image-context-menu", handleImageContextMenu);
  }, [nodes]);

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

  const openImageContextMenu = useCallback(
    (event: MouseEvent, node: WorkflowNode) => {
      const imagePath = nodeResultImagePath(node.data);
      if (!imagePath) return;

      event.preventDefault();
      setSelectedNodeId(node.id);
      setImageContextMenu({
        nodeId: node.id,
        imagePath,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  const saveContextImage = async () => {
    if (!imageContextMenu) return;
    try {
      const destinationPath = await save({
        defaultPath: defaultImageFileName(imageContextMenu.imagePath),
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
      });
      if (!destinationPath) return;
      const savedPath = await invoke<string>("save_image_as", {
        imagePath: imageContextMenu.imagePath,
        destinationPath,
      });
      appendLogs([`已保存图片：${savedPath}`]);
    } catch (error) {
      appendLogs([`保存图片失败：${String(error)}`]);
    } finally {
      setImageContextMenu(null);
    }
  };

  const copyContextImage = async () => {
    if (!imageContextMenu) return;
    try {
      await invoke("copy_image_to_clipboard", { imagePath: imageContextMenu.imagePath });
      appendLogs(["已复制图片到剪切板"]);
    } catch (error) {
      appendLogs([`复制图片失败：${String(error)}`]);
    } finally {
      setImageContextMenu(null);
    }
  };

  const showContextImageInFolder = async () => {
    if (!imageContextMenu) return;
    try {
      await invoke("show_in_folder", { imagePath: imageContextMenu.imagePath });
      appendLogs(["已打开图片所在文件夹"]);
    } catch (error) {
      appendLogs([`打开文件夹失败：${String(error)}`]);
    } finally {
      setImageContextMenu(null);
    }
  };

  const rerunContextNode = () => {
    if (!imageContextMenu) return;
    const nodeId = imageContextMenu.nodeId;
    setImageContextMenu(null);
    runNode(nodeId);
  };

  return (
    <ReactFlowProvider>
      <main className="app-shell" onClick={() => setImageContextMenu(null)}>
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
            onImportImage={importImageToSelectedNode}
            onRun={() => selectedNode && runNode(selectedNode.id)}
          />
        </aside>

        {imageContextMenu && (
          <div
            className="image-context-menu"
            style={{ left: imageContextMenu.x, top: imageContextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={saveContextImage}>
              保存图片
            </button>
            <button type="button" onClick={copyContextImage}>
              复制图片
            </button>
            <button type="button" onClick={showContextImageInFolder}>
              在文件夹中显示
            </button>
            <button type="button" onClick={rerunContextNode}>
              重新运行该节点
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
