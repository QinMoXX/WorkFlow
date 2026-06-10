import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, SelectionMode } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AiSettingsPanel } from "./components/AiSettingsPanel";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { ContextMenu } from "./components/ContextMenu";
import { NodeLibrary } from "./components/NodeLibrary";
import { PropertyPanel } from "./components/PropertyPanel";
import { ToastStack } from "./components/ToastStack";
import { edgeContextMenuActions, imageContextMenuActions } from "./data/mockData";
import { useWorkflowApp } from "./hooks/useWorkflowApp";
import { WorkflowEdge, WorkflowNode } from "./types/workflow";
import "./App.css";

export interface ReadonlyAppProps {}

function App(_props: ReadonlyAppProps) {
  const workflow = useWorkflowApp();

  return (
    <ReactFlowProvider>
      <main className="grid h-screen w-screen grid-cols-[280px_minmax(0,1fr)_336px] overflow-hidden bg-app text-text-primary max-[1180px]:grid-cols-[240px_minmax(0,1fr)]">
        <NodeLibrary
          onAddNode={workflow.handleAddNode}
          onRunWorkflow={workflow.runWorkflow}
          onCancelRun={workflow.cancelActiveRun}
          onSaveWorkflow={workflow.saveWorkflow}
          onOpenSettings={workflow.openSettings}
          isRunActive={workflow.isRunActive}
          canCancelRun={workflow.canCancelRun}
          isCancellingRun={workflow.isCancellingRun}
        />

        <section className="workflow-canvas relative min-h-0 min-w-0" onClick={workflow.closeContextMenus}>
          <CanvasToolbar
            onFitSelected={workflow.fitSelected}
            onFitAll={workflow.fitAll}
            onAutoLayout={workflow.autoLayout}
            onSave={workflow.saveWorkflow}
            onOpenSettings={workflow.openSettings}
          />
          <ReactFlow<WorkflowNode, WorkflowEdge>
            nodes={workflow.nodes}
            edges={workflow.edges}
            nodeTypes={workflow.nodeTypes}
            onNodesChange={workflow.handleNodesChange}
            onEdgesChange={workflow.handleEdgesChange}
            onConnect={workflow.handleConnect}
            isValidConnection={workflow.isValidConnection}
            onInit={workflow.setFlowInstance}
            onNodeClick={(_, node) => workflow.selectNode(node.id)}
            onNodeContextMenu={workflow.openImageContextMenu}
            onEdgeContextMenu={workflow.openEdgeContextMenu}
            onSelectionChange={workflow.handleSelectionChange}
            onPaneClick={() => {
              workflow.selectNode(null);
              workflow.closeContextMenus();
            }}
            selectionOnDrag
            selectionKeyCode={null}
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode={["Control", "Meta", "Shift"]}
            panOnDrag={false}
            panActivationKeyCode="Space"
            deleteKeyCode={null}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </section>

        <aside className="min-h-0 overflow-auto border-l border-border-subtle bg-panel p-5 max-[1180px]:hidden">
          <PropertyPanel
            node={workflow.selectedNode}
            providers={workflow.providers}
            onChange={workflow.updateSelectedNode}
            onImportImage={workflow.importImageToSelectedNode}
            onRun={() => workflow.selectedNode && workflow.runNode(workflow.selectedNode.id)}
            onCancelRun={workflow.cancelActiveRun}
            canRun={!workflow.isRunActive}
            canCancelRun={workflow.selectedNodeCanCancelRun}
            isCancellingRun={workflow.isCancellingRun}
          />
        </aside>

        {workflow.nodeContextMenu && (
          <ContextMenu
            actions={imageContextMenuActions}
            x={workflow.nodeContextMenu.x}
            y={workflow.nodeContextMenu.y}
            hasImage={Boolean(workflow.nodeContextMenu.imagePath)}
            isRunActive={workflow.isRunActive}
            onAction={(actionId) => {
              if (actionId === "save") void workflow.saveContextImage();
              if (actionId === "copy") void workflow.copyContextImage();
              if (actionId === "show") void workflow.showContextImageInFolder();
              if (actionId === "rerun") workflow.rerunContextNode();
              if (actionId === "delete") workflow.deleteContextNode();
            }}
          />
        )}

        {workflow.edgeContextMenu && (
          <ContextMenu
            actions={edgeContextMenuActions}
            x={workflow.edgeContextMenu.x}
            y={workflow.edgeContextMenu.y}
            hasImage={false}
            isRunActive={workflow.isRunActive}
            onAction={(actionId) => {
              if (actionId === "delete-edge") workflow.deleteContextEdge();
            }}
          />
        )}

        <ToastStack toasts={workflow.toasts} />
        <AiSettingsPanel
          isOpen={workflow.isSettingsOpen}
          providers={workflow.providers}
          onClose={workflow.closeSettings}
          onSave={workflow.saveProviderConfigs}
        />
      </main>
    </ReactFlowProvider>
  );
}

export default App;
