import { useState } from "react";
import { Background, MiniMap, ReactFlow, ReactFlowProvider, SelectionMode } from "@xyflow/react";
import { PanelLeftOpen } from "lucide-react";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <ReactFlowProvider>
      <main
        className={[
          "grid h-screen w-screen overflow-hidden bg-app text-text-primary",
          isSidebarCollapsed
            ? "grid-cols-[minmax(0,1fr)]"
            : "grid-cols-[344px_minmax(0,1fr)] max-[1180px]:grid-cols-[300px_minmax(0,1fr)]",
        ].join(" ")}
      >
        {!isSidebarCollapsed && (
          <WorkspaceSidebar
            nodes={workflow.nodes}
            canvases={workflow.canvases}
            activeCanvasId={workflow.activeCanvasId}
            assetRootDir={workflow.assetRootDir}
            onCollapse={() => setIsSidebarCollapsed(true)}
            onCreateCanvas={workflow.createCanvas}
            onSwitchCanvas={workflow.switchCanvas}
            onChooseAssetRootDir={workflow.chooseAssetRootDir}
            onResetAssetRootDir={workflow.resetAssetRootDir}
            onRenameCanvas={workflow.renameCanvas}
            onDeleteCanvas={workflow.deleteCanvas}
            onOpenCanvasAssetDir={workflow.openCanvasAssetDir}
          />
        )}

        {isSidebarCollapsed && (
          <button
            className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-lg border border-border-default bg-panel-raised text-text-primary shadow-floating transition hover:bg-control-hover"
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            title="展开侧边栏"
          >
            <PanelLeftOpen size={19} />
          </button>
        )}

        <section className="workflow-canvas relative min-h-0 min-w-0" onClick={workflow.closeContextMenus}>
          <CanvasToolbar
            isSidebarCollapsed={isSidebarCollapsed}
            onFitSelected={workflow.fitSelected}
            onFitAll={workflow.fitAll}
            onAutoLayout={workflow.autoLayout}
            onOpenSettings={workflow.openSettings}
          />
          <ReactFlow<WorkflowNode, WorkflowEdge>
            nodes={workflow.nodes}
            edges={workflow.edges}
            nodeTypes={workflow.nodeTypes}
            onNodesChange={workflow.handleNodesChange}
            onEdgesChange={workflow.handleEdgesChange}
            onConnect={workflow.handleConnect}
            onConnectStart={workflow.handleConnectStart}
            onConnectEnd={workflow.handleConnectEnd}
            isValidConnection={workflow.isValidConnection}
            onInit={workflow.handleFlowInit}
            onViewportChange={workflow.handleViewportChange}
            onMoveStart={workflow.handleMoveStart}
            onNodeClick={(_, node) => workflow.selectNode(node.id)}
            onNodeDragStart={workflow.handleSelectionStart}
            onNodeContextMenu={workflow.openImageContextMenu}
            onEdgeContextMenu={workflow.openEdgeContextMenu}
            onPaneContextMenu={workflow.openPaneContextMenu}
            onSelectionChange={workflow.handleSelectionChange}
            onSelectionStart={workflow.handleSelectionStart}
            onPaneClick={workflow.handlePaneClick}
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

        {workflow.nodePickerMenu?.connectionLine && (
          <svg className="workflow-connection-menu-line" aria-hidden="true">
            <path d={connectionMenuPath(workflow.nodePickerMenu.connectionLine)} />
          </svg>
        )}

        {workflow.nodePickerMenu && (
          <NodePickerMenu
            x={workflow.nodePickerMenu.x}
            y={workflow.nodePickerMenu.y}
            kinds={workflow.nodePickerMenu.candidateKinds}
            isConnectionPicker={Boolean(workflow.nodePickerMenu.connectionOrigin)}
            onSelectNode={workflow.addNodeFromPicker}
          />
        )}

        <ToastStack toasts={workflow.toasts} />
        <AiSettingsPanel
          isOpen={workflow.isSettingsOpen}
          config={workflow.apiConfig}
          onClose={workflow.closeSettings}
          onSave={workflow.saveApiConfig}
        />
      </main>
    </ReactFlowProvider>
  );
}

function connectionMenuPath(line: { fromX: number; fromY: number; toX: number; toY: number }) {
  const controlOffset = Math.max(80, Math.abs(line.toX - line.fromX) * 0.45);
  return [
    `M ${line.fromX} ${line.fromY}`,
    `C ${line.fromX + controlOffset} ${line.fromY}`,
    `${line.toX - controlOffset} ${line.toY}`,
    `${line.toX} ${line.toY}`,
  ].join(" ");
}

export default App;
