import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  FileText,
  FolderCog,
  FolderOpen,
  ImageIcon,
  LayoutGrid,
  Library,
  PanelLeftClose,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { workspaceSidebarCopy, workspaceSidebarTabs } from "../data/mockData";
import { toImageSource } from "../lib/imageSource";
import { WorkflowCanvas, WorkflowNode } from "../types/workflow";

export interface SidebarAsset {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly thumbnailPath?: string;
}

export interface ReadonlyWorkspaceSidebarProps {
  readonly nodes: WorkflowNode[];
  readonly canvases: WorkflowCanvas[];
  readonly activeCanvasId: string;
  readonly assetRootDir?: string | null;
  readonly onCollapse: () => void;
  readonly onCreateCanvas: () => void;
  readonly onSwitchCanvas: (canvasId: string) => void;
  readonly onChooseAssetRootDir: () => void;
  readonly onResetAssetRootDir: () => void;
  readonly onRenameCanvas: (canvasId: string) => void;
  readonly onDeleteCanvas: (canvasId: string) => void;
  readonly onOpenCanvasAssetDir: (canvasId: string) => void;
}

type SidebarTabId = (typeof workspaceSidebarTabs)[number]["id"];
type CanvasContextMenu = {
  canvasId: string;
  x: number;
  y: number;
};

function collectAssets(nodes: WorkflowNode[]): SidebarAsset[] {
  return nodes.flatMap((node) => {
    const imagePath = node.data.imagePath || node.data.resultPath || node.data.lastOutputPath;
    if (!imagePath) return [];
    return [
      {
        id: node.id,
        title: node.data.title || workspaceSidebarCopy.assetImageFallback,
        path: imagePath,
        thumbnailPath: node.data.thumbnailPath || node.data.resultPath || imagePath,
      },
    ];
  });
}

export function WorkspaceSidebar({
  nodes,
  canvases,
  activeCanvasId,
  assetRootDir,
  onCollapse,
  onCreateCanvas,
  onSwitchCanvas,
  onChooseAssetRootDir,
  onResetAssetRootDir,
  onRenameCanvas,
  onDeleteCanvas,
  onOpenCanvasAssetDir,
}: ReadonlyWorkspaceSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTabId>("canvases");
  const [canvasContextMenu, setCanvasContextMenu] = useState<CanvasContextMenu | null>(null);
  const assets = useMemo(() => collectAssets(nodes), [nodes]);

  useEffect(() => {
    if (!canvasContextMenu) return undefined;
    const closeMenu = () => setCanvasContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
    };
  }, [canvasContextMenu]);

  const openCanvasContextMenu = (event: ReactMouseEvent, canvasId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setCanvasContextMenu({
      canvasId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const runCanvasAction = (action: (canvasId: string) => void) => {
    if (!canvasContextMenu) return;
    const { canvasId } = canvasContextMenu;
    setCanvasContextMenu(null);
    action(canvasId);
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-panel text-text-primary">
      <header className="flex justify-end border-b border-border-subtle px-4 py-4">
        <button
          className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control hover:text-text-primary"
          type="button"
          onClick={onCollapse}
          title={workspaceSidebarCopy.collapseSidebar}
        >
          <PanelLeftClose size={17} />
        </button>
      </header>

      <div className="flex items-center justify-between border-b border-border-subtle px-2 py-3">
        <div className="flex gap-2">
          {workspaceSidebarTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={[
                "rounded-md px-3 py-1.5 text-sm font-bold transition",
                activeTab === tab.id
                  ? "bg-control-hover text-text-primary"
                  : "text-text-secondary hover:bg-control hover:text-text-primary",
              ].join(" ")}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Library size={18} className="mr-2 text-text-secondary" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-5">
        {activeTab === "canvases" ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-muted">{workspaceSidebarCopy.canvasListTitle}</span>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control hover:text-text-primary"
                type="button"
                onClick={onCreateCanvas}
                title={workspaceSidebarCopy.createCanvas}
              >
                <Plus size={16} />
              </button>
            </div>
            {canvases.length === 0 ? (
              <div className="grid gap-2 rounded-lg border border-dashed border-border-default bg-control/40 p-4">
                <strong className="text-sm text-text-primary">{workspaceSidebarCopy.emptyCanvasTitle}</strong>
                <span className="text-xs leading-5 text-text-muted">{workspaceSidebarCopy.emptyCanvasDescription}</span>
              </div>
            ) : (
              <div className="grid gap-2">
                {canvases.map((canvas) => {
                  const isActive = canvas.id === activeCanvasId;
                  return (
                    <button
                      key={canvas.id}
                      className={[
                        "flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left transition",
                        isActive
                          ? "border-text-primary bg-control-hover text-text-primary"
                          : "border-border-subtle bg-control/30 text-text-secondary hover:border-border-default hover:text-text-primary",
                      ].join(" ")}
                      type="button"
                      onClick={() => onSwitchCanvas(canvas.id)}
                      onContextMenu={(event) => openCanvasContextMenu(event, canvas.id)}
                    >
                      <LayoutGrid size={15} className="flex-none" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{canvas.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-5 grid gap-3 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-text-muted">{workspaceSidebarCopy.assetRootTitle}</span>
                <div className="flex gap-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control hover:text-text-primary"
                    type="button"
                    onClick={onChooseAssetRootDir}
                    title={workspaceSidebarCopy.chooseAssetRoot}
                  >
                    <FolderCog size={16} />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control hover:text-text-primary"
                    type="button"
                    onClick={onResetAssetRootDir}
                    title={workspaceSidebarCopy.resetAssetRoot}
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </div>
              <div className="truncate rounded-md bg-control/50 px-3 py-2 text-xs text-text-muted">
                {assetRootDir || workspaceSidebarCopy.defaultAssetRoot}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-muted">{workspaceSidebarCopy.assetsListTitle}</span>
              <div className="flex items-center gap-3 text-sm text-text-primary">
                <button className="inline-flex items-center gap-1" type="button">
                  {workspaceSidebarCopy.allFilter}
                </button>
                <Search size={18} className="text-text-secondary" />
              </div>
            </div>

            {assets.length === 0 ? (
              <div className="grid gap-2 rounded-lg border border-dashed border-border-default bg-control/40 p-4">
                <strong className="text-sm text-text-primary">{workspaceSidebarCopy.emptyAssetsTitle}</strong>
                <span className="text-xs leading-5 text-text-muted">{workspaceSidebarCopy.emptyAssetsDescription}</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {assets.map((asset) => (
                  <div className="flex min-w-0 items-center gap-3" key={asset.id}>
                    <div className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-lg bg-control-hover">
                      {asset.thumbnailPath ? (
                        <img
                          className="h-full w-full object-cover"
                          src={toImageSource(asset.thumbnailPath)}
                          alt={asset.title}
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon size={18} className="text-text-secondary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-text-primary">{asset.title}</div>
                      <div className="truncate text-xs text-text-muted">{asset.path}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {canvasContextMenu && (
        <div
          className="fixed z-40 grid min-w-44 overflow-hidden rounded-lg border border-border-default bg-panel-raised p-1 shadow-floating"
          style={{ left: canvasContextMenu.x, top: canvasContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            className="flex h-9 items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
            type="button"
            onClick={() => runCanvasAction(onRenameCanvas)}
          >
            <Pencil size={15} />
            <span>{workspaceSidebarCopy.renameCanvas}</span>
          </button>
          <button
            className="flex h-9 items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
            type="button"
            onClick={() => runCanvasAction(onOpenCanvasAssetDir)}
          >
            <FolderOpen size={15} />
            <span>{workspaceSidebarCopy.openCanvasDir}</span>
          </button>
          <button
            className="flex h-9 items-center gap-2 rounded-md px-3 text-left text-sm text-danger transition hover:bg-danger/10"
            type="button"
            onClick={() => runCanvasAction(onDeleteCanvas)}
          >
            <Trash2 size={15} />
            <span>{workspaceSidebarCopy.deleteCanvas}</span>
          </button>
        </div>
      )}

      <footer className="flex items-center justify-between border-t border-border-subtle px-5 py-4 text-sm text-text-secondary">
        <FileText size={16} />
        <span>
          {workspaceSidebarCopy.allFilter} {nodes.length} {workspaceSidebarCopy.nodeCountSuffix}
        </span>
      </footer>
    </aside>
  );
}
