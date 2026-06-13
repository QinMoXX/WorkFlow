import { useRef, type MouseEvent, type PointerEvent } from "react";
import { nodePickerCopy, nodeTemplates } from "../data/mockData";
import { WorkflowNodeKind } from "../types/workflow";

export interface ReadonlyNodePickerMenuProps {
  readonly x: number;
  readonly y: number;
  readonly kinds?: readonly WorkflowNodeKind[];
  readonly onSelectNode: (kind: WorkflowNodeKind) => void;
}

export function NodePickerMenu({ x, y, kinds, onSelectNode }: ReadonlyNodePickerMenuProps) {
  const selectedRef = useRef(false);
  const templates = kinds
    ? nodeTemplates.filter((template) => kinds.includes(template.kind))
    : nodeTemplates;

  const selectNode = (kind: WorkflowNodeKind, event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (selectedRef.current) return;

    selectedRef.current = true;
    onSelectNode(kind);
  };

  return (
    <div
      className="fixed z-30 w-64 rounded-xl border border-border-default bg-panel-raised p-2 shadow-floating"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-border-subtle px-3 py-2">
        <div className="text-sm font-bold text-text-primary">{nodePickerCopy.title}</div>
        <div className="mt-1 text-xs leading-4 text-text-muted">{nodePickerCopy.description}</div>
      </div>
      <div className="mt-2 grid gap-1">
        {templates.map((template) => (
          <button
            key={template.kind}
            type="button"
            className="grid gap-1 rounded-lg px-3 py-2 text-left transition hover:bg-control-hover"
            onPointerUp={(event) => selectNode(template.kind, event)}
            onClick={(event) => selectNode(template.kind, event)}
          >
            <strong className="text-sm text-text-primary">{template.title}</strong>
            <span className="text-xs leading-4 text-text-muted">{template.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
