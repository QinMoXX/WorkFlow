import { useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ChevronDown, FileText, ImageIcon, LayoutGrid, Library, Search } from "lucide-react";
import { appCopy, workspaceSidebarCopy, workspaceSidebarTabs } from "../data/mockData";
import { WorkflowNode } from "../types/workflow";

export interface SidebarAsset {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly thumbnailPath?: string;
}

export interface ReadonlyWorkspaceSidebarProps {
  readonly nodes: WorkflowNode[];
}

function toImageSource(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return convertFileSrc(path);
}

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

export function WorkspaceSidebar({ nodes }: ReadonlyWorkspaceSidebarProps) {
  const [activeTab, setActiveTab] = useState<(typeof workspaceSidebarTabs)[number]["id"]>("canvases");
  const assets = useMemo(() => collectAssets(nodes), [nodes]);

  return (
    <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-panel text-text-primary">
      <header className="border-b border-border-subtle px-4 py-5">
        <div className="mb-5 flex items-center gap-2">
          <div className="h-5 w-8 -skew-x-12 border-4 border-text-primary" aria-hidden="true" />
          <ChevronDown size={16} className="text-text-secondary" />
        </div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span>{appCopy.projectName}</span>
          <span className="text-text-muted">|</span>
          <button className="inline-flex items-center gap-1 text-text-primary" type="button">
            {appCopy.currentCanvasName}
            <ChevronDown size={14} />
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
              <LayoutGrid size={16} className="text-text-muted" />
            </div>
            <div className="grid gap-2 rounded-lg border border-dashed border-border-default bg-control/40 p-4">
              <strong className="text-sm text-text-primary">{workspaceSidebarCopy.emptyCanvasTitle}</strong>
              <span className="text-xs leading-5 text-text-muted">{workspaceSidebarCopy.emptyCanvasDescription}</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-semibold text-text-muted">{workspaceSidebarCopy.assetsListTitle}</span>
              <div className="flex items-center gap-3 text-sm text-text-primary">
                <button className="inline-flex items-center gap-1" type="button">
                  {workspaceSidebarCopy.allFilter}
                  <ChevronDown size={14} />
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

      <footer className="flex items-center justify-between border-t border-border-subtle px-5 py-4 text-sm text-text-secondary">
        <FileText size={16} />
        <span>
          {workspaceSidebarCopy.allFilter} {nodes.length} {workspaceSidebarCopy.nodeCountSuffix}
        </span>
      </footer>
    </aside>
  );
}
