import { nodeTemplates } from "../lib/nodeCatalog";
import { WorkflowNodeKind } from "../types/workflow";

type NodeLibraryProps = {
  onAddNode: (kind: WorkflowNodeKind) => void;
  onRunWorkflow: () => void;
  onSaveWorkflow: () => void;
  onOpenSettings: () => void;
};

export function NodeLibrary({ onAddNode, onRunWorkflow, onSaveWorkflow, onOpenSettings }: NodeLibraryProps) {
  return (
    <aside className="node-library">
      <div className="brand">
        <span>WorkFlow</span>
        <small>AI 图片工作流</small>
      </div>
      <div className="library-list">
        {nodeTemplates.map((template) => (
          <button
            key={template.kind}
            className="library-item"
            type="button"
            onClick={() => onAddNode(template.kind)}
          >
            <strong>{template.title}</strong>
            <span>{template.description}</span>
          </button>
        ))}
      </div>
      <button className="primary-action" type="button" onClick={onRunWorkflow}>
        运行全部
      </button>
      <button className="secondary-action" type="button" onClick={onSaveWorkflow}>
        保存工作流
      </button>
      <button className="secondary-action" type="button" onClick={onOpenSettings}>
        AI 配置
      </button>
    </aside>
  );
}
