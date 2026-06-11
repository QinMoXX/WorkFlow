import { Background, MiniMap, ReactFlow, ReactFlowProvider, SelectionMode } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AiSettingsPanel } from "./components/AiSettingsPanel";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { ContextMenu } from "./components/ContextMenu";
import { NodePickerMenu } from "./components/NodePickerMenu";
import { NodeSettingsPopover } from "./components/NodeSettingsPopover";
import { ToastStack } from "./components/ToastStack";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { edgeContextMenuActions, imageContextMenuActions, paneContextMenuActions } from "./data/mockData";
import { useWorkflowApp } from "./hooks/useWorkflowApp";
import { WorkflowEdge, WorkflowNode } from "./types/workflow";
import "./App.css";

export interface ReadonlyAppProps {}

function App(_props: ReadonlyAppProps) {
  const workflow = useWorkflowApp();

  return (
    <ReactFlowProvider>
      <main className="grid h-screen w-screen grid-cols-[344px_minmax(0,1fr)] overflow-hidden bg-app text-text-primary max-[1180px]:grid-cols-[300px_minmax(0,1fr)]">
        <WorkspaceSidebar nodes={workflow.nodes} />

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
            onInit={workflow.handleFlowInit}
            onViewportChange={workflow.handleViewportChange}
            onNodeClick={(_, node) => workflow.selectNode(node.id)}
            onNodeContextMenu={workflow.openImageContextMenu}
            onEdgeContextMenu={workflow.openEdgeContextMenu}
            onPaneContextMenu={workflow.openPaneContextMenu}
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
            fitView={!workflow.hasSavedViewport}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} />
            <NodeSettingsPopover
              node={workflow.nodeSettingsNode}
              providers={workflow.providers}
              onChange={workflow.updateSelectedNode}
              onImportImage={workflow.importImageToSelectedNode}
              onRun={() => workflow.nodeSettingsNode && workflow.runNode(workflow.nodeSettingsNode.id)}
              onCancelRun={workflow.cancelActiveRun}
              canRun={!workflow.isRunActive}
              canCancelRun={workflow.selectedNodeCanCancelRun}
              isCancellingRun={workflow.isCancellingRun}
            />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </section>

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

        {workflow.paneContextMenu && (
          <ContextMenu
            actions={paneContextMenuActions}
            x={workflow.paneContextMenu.x}
            y={workflow.paneContextMenu.y}
            hasImage={false}
            isRunActive={workflow.isRunActive}
            onAction={(actionId) => {
              if (actionId === "add-node") workflow.openNodePickerFromPaneMenu();
            }}
          />
        )}

        {workflow.nodePickerMenu && (
          <NodePickerMenu
            x={workflow.nodePickerMenu.x}
            y={workflow.nodePickerMenu.y}
            onSelectNode={workflow.addNodeFromPicker}
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
