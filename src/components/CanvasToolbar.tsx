import { Bot, Crosshair, Maximize2, Workflow } from "lucide-react";
import { canvasToolbarActions } from "../data/mockData";

export interface ReadonlyCanvasToolbarProps {
  readonly isSidebarCollapsed?: boolean;
  readonly onFitSelected: () => void;
  readonly onFitAll: () => void;
  readonly onAutoLayout: () => void;
  readonly onOpenSettings: () => void;
}

const handlers = {
  fitSelected: "onFitSelected",
  fitAll: "onFitAll",
  autoLayout: "onAutoLayout",
  settings: "onOpenSettings",
} as const;

const icons = {
  fitSelected: Crosshair,
  fitAll: Maximize2,
  autoLayout: Workflow,
  settings: Bot,
} as const;

export function CanvasToolbar(props: ReadonlyCanvasToolbarProps) {
  const toolbarPositionClassName = [
    "pointer-events-none absolute inset-x-0 top-5 z-10 flex justify-center px-4",
    props.isSidebarCollapsed ? "pl-20" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={toolbarPositionClassName}>
      <div className="pointer-events-none flex max-w-full items-center gap-2 overflow-x-auto rounded-xl border border-border-default bg-panel-raised/95 p-2 shadow-floating backdrop-blur">
        <span className="shrink-0 rounded-pill bg-new px-2 py-1 text-[11px] font-bold leading-none text-text-inverse">
          NEW
        </span>
        {canvasToolbarActions.map((action) => {
          const Icon = icons[action.id as keyof typeof icons];
          const handlerName = handlers[action.id as keyof typeof handlers];
          return (
            <button
              key={action.id}
              type="button"
              className="pointer-events-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
              onClick={props[handlerName]}
              title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
              aria-label={action.label}
            >
              <Icon size={16} />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
