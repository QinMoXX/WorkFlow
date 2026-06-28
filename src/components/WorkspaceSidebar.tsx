import { useEffect, useMemo, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutGrid,
  Library,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { workspaceSidebarCopy, workspaceSidebarTabs } from "../data/mockData";
import { toImageSource } from "../lib/imageSource";
import { ProjectAsset, ProjectAssetKind, WorkflowCanvas, WorkflowNode, WorkflowProjectSummary } from "../types/workflow";

export interface ReadonlyWorkspaceSidebarProps {
  readonly nodes: WorkflowNode[];
  readonly projects: WorkflowProjectSummary[];
  readonly activeProjectId: string;
  readonly canvases: WorkflowCanvas[];
  readonly activeCanvasId: string;
  readonly assets: ProjectAsset[];
  readonly assetRootDir?: string | null;
  readonly onCollapse: () => void;
  readonly onCreateProject: () => void;
  readonly onSwitchProject: (projectId: string) => void;
  readonly onCreateCanvas: () => void;
  readonly onSwitchCanvas: (canvasId: string) => void;
  readonly onChooseAssetRootDir: () => void;
  readonly onResetAssetRootDir: () => void;
  readonly onRenameCanvas: (canvasId: string) => void;
  readonly onDeleteCanvas: (canvasId: string) => void;
  readonly onOpenCanvasAssetDir: (canvasId: string) => void;
  readonly onAddAssetToCanvas: (asset: ProjectAsset) => void;
  readonly onDeleteAsset: (asset: ProjectAsset) => void;
  readonly onOpenAsset: (asset: ProjectAsset) => void;
}

type SidebarTabId = (typeof workspaceSidebarTabs)[number]["id"];
type AssetFilter = "all" | ProjectAssetKind;
type CanvasContextMenu = {
  canvasId: string;
  x: number;
  y: number;
};

const assetFilters: Array<{ id: AssetFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "imported", label: "导入" },
  { id: "generated", label: "生成" },
  { id: "output", label: "输出" },
];

export function WorkspaceSidebar({
  nodes,
  projects,
  activeProjectId,
  canvases,
  activeCanvasId,
  assets,
  onCollapse,
  onCreateProject,
  onSwitchProject,
  onCreateCanvas,
  onSwitchCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  onOpenCanvasAssetDir,
  onAddAssetToCanvas,
  onDeleteAsset,
  onOpenAsset,
}: ReadonlyWorkspaceSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTabId>("canvases");
  const [canvasContextMenu, setCanvasContextMenu] = useState<CanvasContextMenu | null>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");

  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    return assets.filter((asset) => {
      if (assetFilter !== "all" && asset.kind !== assetFilter) return false;
      if (!query) return true;
      return asset.name.toLowerCase().includes(query) || asset.path.toLowerCase().includes(query);
    });
  }, [assetFilter, assetQuery, assets]);

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

  const handleAssetDragStart = (event: DragEvent, asset: ProjectAsset) => {
    event.dataTransfer.setData("application/workflow-asset", JSON.stringify(asset));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-panel text-text-primary">
      <header className="grid gap-3 border-b border-border-subtle px-4 py-4">
        <div className="flex items-center gap-2">
          <select
            className="min-w-0 flex-1"
            value={activeProjectId}
            onChange={(event) => onSwitchProject(event.target.value)}
            aria-label={workspaceSidebarCopy.projectSelector}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control hover:text-text-primary"
            type="button"
            onClick={onCreateProject}
            title={workspaceSidebarCopy.createProject}
          >
            <Plus size={16} />
          </button>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control hover:text-text-primary"
            type="button"
            onClick={onCollapse}
            title={workspaceSidebarCopy.collapseSidebar}
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
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
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3">
              <label className="relative block">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  className="h-9 w-full rounded-md border border-border-default bg-control pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
                  value={assetQuery}
                  onChange={(event) => setAssetQuery(event.target.value)}
                  placeholder={workspaceSidebarCopy.searchAssets}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {assetFilters.map((filter) => (
                  <button
                    key={filter.id}
                    className={[
                      "rounded-md px-2.5 py-1 text-xs font-bold transition",
                      assetFilter === filter.id
                        ? "bg-control-hover text-text-primary"
                        : "bg-control/40 text-text-secondary hover:bg-control-hover hover:text-text-primary",
                    ].join(" ")}
                    type="button"
                    onClick={() => setAssetFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredAssets.length === 0 ? (
              <div className="grid gap-2 rounded-lg border border-dashed border-border-default bg-control/40 p-4">
                <strong className="text-sm text-text-primary">{workspaceSidebarCopy.emptyAssetsTitle}</strong>
                <span className="text-xs leading-5 text-text-muted">{workspaceSidebarCopy.emptyAssetsDescription}</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredAssets.map((asset) => (
                  <div
                    className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border-subtle bg-control/25 p-2"
                    key={asset.id}
                    draggable
                    onDragStart={(event) => handleAssetDragStart(event, asset)}
                    title={workspaceSidebarCopy.dragAssetHint}
                  >
                    <button
                      className="grid h-10 w-10 place-items-center overflow-hidden rounded-md bg-control-hover"
                      type="button"
                      onClick={() => onAddAssetToCanvas(asset)}
                      title={workspaceSidebarCopy.addAssetToCanvas}
                    >
                      {asset.thumbnailPath ? (
                        <img
                          className="h-full w-full object-cover"
                          src={toImageSource(asset.thumbnailPath)}
                          alt={asset.name}
                          loading="lazy"
                        />
                      ) : (
                        <ImageIcon size={18} className="text-text-secondary" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-text-primary">{asset.name}</div>
                      <div className="truncate text-xs text-text-muted">{asset.kind} · {formatBytes(asset.sizeBytes)}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-md text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
                        type="button"
                        onClick={() => onOpenAsset(asset)}
                        title={workspaceSidebarCopy.openAsset}
                      >
                        <FolderOpen size={15} />
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-md text-danger transition hover:bg-danger/10"
                        type="button"
                        onClick={() => onDeleteAsset(asset)}
                        title={workspaceSidebarCopy.deleteAsset}
                      >
                        <Trash2 size={15} />
                      </button>
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
            <span>{workspaceSidebarCopy.openProjectAssets}</span>
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

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
