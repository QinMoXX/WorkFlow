import { Bot, Play, Plus, Save, Square } from "lucide-react";
import { appCopy, nodeLibraryCopy, nodeTemplates } from "../data/mockData";
import { WorkflowNodeKind } from "../types/workflow";

export interface ReadonlyNodeLibraryProps {
  readonly onAddNode: (kind: WorkflowNodeKind) => void;
  readonly onRunWorkflow: () => void;
  readonly onCancelRun: () => void;
  readonly onSaveWorkflow: () => void;
  readonly onOpenSettings: () => void;
  readonly isRunActive: boolean;
  readonly canCancelRun: boolean;
  readonly isCancellingRun: boolean;
}

export function NodeLibrary({
  onAddNode,
  onRunWorkflow,
  onCancelRun,
  onSaveWorkflow,
  onOpenSettings,
  isRunActive,
  canCancelRun,
  isCancellingRun,
}: ReadonlyNodeLibraryProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-4 border-r border-border-subtle bg-panel p-5">
      <div className="border-b border-border-subtle pb-4">
        <span className="block text-2xl font-bold tracking-normal text-text-primary">{appCopy.brandName}</span>
        <small className="text-xs font-medium text-text-muted">{appCopy.brandSubtitle}</small>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
          {appCopy.nodeLibraryTitle}
        </span>
        <Plus size={16} className="text-text-muted" />
      </div>

      <div className="grid gap-2">
        {nodeTemplates.map((template) => (
          <button
            key={template.kind}
            className="grid gap-1 rounded-lg border border-border-default bg-control p-3 text-left transition hover:border-border-strong hover:bg-control-hover"
            type="button"
            onClick={() => onAddNode(template.kind)}
          >
            <strong className="text-sm font-bold text-text-primary">{template.title}</strong>
            <span className="text-xs leading-4 text-text-muted">{template.description}</span>
          </button>
        ))}
      </div>

      <button
        className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-pill bg-inverse px-4 text-sm font-bold text-text-inverse transition hover:bg-text-primary"
        type="button"
        onClick={onRunWorkflow}
      >
        <Play size={16} />
        {isRunActive ? nodeLibraryCopy.runAllActive : nodeLibraryCopy.runAllIdle}
      </button>
      {isRunActive && (
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 text-sm font-bold text-danger transition hover:bg-danger/15"
          type="button"
          onClick={onCancelRun}
          disabled={!canCancelRun || isCancellingRun}
        >
          <Square size={15} />
          {isCancellingRun ? nodeLibraryCopy.cancelling : nodeLibraryCopy.cancelRun}
        </button>
      )}
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-default bg-control px-4 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
        type="button"
        onClick={onSaveWorkflow}
      >
        <Save size={15} />
        {nodeLibraryCopy.saveWorkflow}
      </button>
      <button
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border-default bg-control px-4 text-sm font-semibold text-text-secondary transition hover:bg-control-hover hover:text-text-primary"
        type="button"
        onClick={onOpenSettings}
      >
        <Bot size={15} />
        {nodeLibraryCopy.aiSettings}
      </button>
    </aside>
  );
}
