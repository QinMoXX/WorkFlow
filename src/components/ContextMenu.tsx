import { Copy, FolderOpen, ImageDown, Play, Trash2 } from "lucide-react";
import { ContextMenuAction } from "../data/mockData";

export interface ReadonlyContextMenuProps {
  readonly actions: ContextMenuAction[];
  readonly x: number;
  readonly y: number;
  readonly hasImage: boolean;
  readonly isRunActive: boolean;
  readonly onAction: (actionId: string) => void;
}

const icons: Record<string, typeof ImageDown> = {
  save: ImageDown,
  copy: Copy,
  show: FolderOpen,
  rerun: Play,
  delete: Trash2,
  "delete-edge": Trash2,
};

export function ContextMenu({
  actions,
  x,
  y,
  hasImage,
  isRunActive,
  onAction,
}: ReadonlyContextMenuProps) {
  return (
    <div
      className="fixed z-30 grid min-w-48 overflow-hidden rounded-lg border border-border-default bg-panel-raised p-1 shadow-floating"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => {
        const Icon = icons[action.id] ?? ImageDown;
        const disabled = (action.requiresImage && !hasImage) || (action.id === "rerun" && isRunActive);
        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            className={[
              "flex h-9 items-center gap-2 rounded-md px-3 text-left text-sm transition",
              action.danger
                ? "text-danger hover:bg-danger/10"
                : "text-text-secondary hover:bg-control-hover hover:text-text-primary",
            ].join(" ")}
            onClick={() => onAction(action.id)}
          >
            <Icon size={15} />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
