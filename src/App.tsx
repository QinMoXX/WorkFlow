import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Background,
  Connection,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeLibrary } from "./components/NodeLibrary";
import { PropertyPanel } from "./components/PropertyPanel";
import { RunLogPanel } from "./components/RunLogPanel";
import { WorkflowNodeCard } from "./components/WorkflowNodeCard";
import { createNode, initialEdges, initialNodes } from "./lib/nodeCatalog";
import { fromSnapshot, inputType, outputType, toSnapshot } from "./lib/workflowGraph";
import { RunResponse, WorkflowNodeData, WorkflowNodeKind, WorkflowSnapshot } from "./types/workflow";
import "./App.css";

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0].id);
  const [logs, setLogs] = useState<string[]>(["工作流已就绪"]);
  const [isLogOpen, setIsLogOpen] = useState(true);

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
        />

        <section className="canvas-panel">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
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
            onChange={updateSelectedNode}
            onRun={() => selectedNode && runNode(selectedNode.id)}
          />
        </aside>

        <RunLogPanel logs={logs} isOpen={isLogOpen} onToggle={() => setIsLogOpen((value) => !value)} />
      </main>
    </ReactFlowProvider>
  );
}

export default App;
