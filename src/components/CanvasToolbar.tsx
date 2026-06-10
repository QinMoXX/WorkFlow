import { Bot, Crosshair, Maximize2, Save, Workflow } from "lucide-react";
import { canvasToolbarActions } from "../data/mockData";

export interface ReadonlyCanvasToolbarProps {
  readonly onFitSelected: () => void;
  readonly onFitAll: () => void;
  readonly onAutoLayout: () => void;
  readonly onSave: () => void;
  readonly onOpenSettings: () => void;
}

const handlers = {
  fitSelected: "onFitSelected",
  fitAll: "onFitAll",
  autoLayout: "onAutoLayout",
  save: "onSave",
  settings: "onOpenSettings",
} as const;

const icons = {
  fitSelected: Crosshair,
  fitAll: Maximize2,
  autoLayout: Workflow,
  save: Save,
  settings: Bot,
} as const;

export function CanvasToolbar(props: ReadonlyCanvasToolbarProps) {
  return (
    <div className="pointer-events-none absolute left-6 top-5 z-10 flex items-center gap-2 rounded-xl border border-border-default bg-panel-raised/95 p-2 shadow-floating backdrop-blur">
      <span className="rounded-pill bg-new px-2 py-1 text-[11px] font-bold leading-none text-text-inverse">
        NEW
      </span>
      {canvasToolbarActions.map((action) => {
        const Icon = icons[action.id as keyof typeof icons];
        const handlerName = handlers[action.id as keyof typeof handlers];
        return (
          <button
            key={action.id}
            type="button"
            className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
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
  );
}
