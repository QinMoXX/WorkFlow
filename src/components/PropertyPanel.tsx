import { WorkflowNode, WorkflowNodeData } from "../types/workflow";

type PropertyPanelProps = {
  node: WorkflowNode | null;
  onChange: (patch: Partial<WorkflowNodeData>) => void;
  onRun: () => void;
};

export function PropertyPanel({ node, onChange, onRun }: PropertyPanelProps) {
  if (!node) {
    return (
      <div className="empty-panel">
        <strong>未选择节点</strong>
        <span>选择画布上的节点后编辑参数。</span>
      </div>
    );
  }

  const data = node.data;

  return (
    <div className="property-form">
      <header>
        <div>
          <span className="panel-kicker">节点属性</span>
          <h2>{data.title}</h2>
        </div>
        <button type="button" onClick={onRun}>
          运行
        </button>
      </header>

      <label>
        名称
        <input value={data.title} onChange={(event) => onChange({ title: event.target.value })} />
      </label>

      {data.kind === "textInput" && (
        <label>
          文本内容
          <textarea
            value={data.content ?? ""}
            onChange={(event) => onChange({ content: event.target.value })}
            rows={8}
          />
        </label>
      )}

      {data.kind === "imageInput" && (
        <label>
          图片路径
          <input
            value={data.imagePath ?? ""}
            onChange={(event) => onChange({ imagePath: event.target.value })}
            placeholder="/path/to/image.png"
          />
        </label>
      )}

      {(data.kind === "textToImage" || data.kind === "imageToImage") && (
        <>
          <label>
            供应商
            <input
              value={data.providerId ?? ""}
              onChange={(event) => onChange({ providerId: event.target.value })}
            />
          </label>
          <label>
            模型
            <input value={data.model ?? ""} onChange={(event) => onChange({ model: event.target.value })} />
          </label>
          <label>
            Prompt 覆盖
            <textarea
              value={data.promptOverride ?? ""}
              onChange={(event) => onChange({ promptOverride: event.target.value })}
              rows={5}
            />
          </label>
          <label>
            画幅
            <select
              value={data.aspectRatio ?? "1:1"}
              onChange={(event) => onChange({ aspectRatio: event.target.value })}
            >
              <option value="1:1">1:1</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
            </select>
          </label>
          <label>
            风格
            <input
              value={data.stylePreset ?? ""}
              onChange={(event) => onChange({ stylePreset: event.target.value })}
            />
          </label>
          <label>
            Seed
            <input value={data.seed ?? ""} onChange={(event) => onChange({ seed: event.target.value })} />
          </label>
        </>
      )}

      {data.kind === "textToImage" && (
        <label>
          负向 Prompt
          <textarea
            value={data.negativePrompt ?? ""}
            onChange={(event) => onChange({ negativePrompt: event.target.value })}
            rows={4}
          />
        </label>
      )}

      {data.kind === "imageToImage" && (
        <label>
          修改强度
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={data.strength ?? 0.65}
            onChange={(event) => onChange({ strength: Number(event.target.value) })}
          />
          <span>{data.strength ?? 0.65}</span>
        </label>
      )}

      {data.kind === "output" && (
        <label>
          保存目录
          <input
            value={data.saveDirectory ?? ""}
            onChange={(event) => onChange({ saveDirectory: event.target.value })}
          />
        </label>
      )}
    </div>
  );
}
