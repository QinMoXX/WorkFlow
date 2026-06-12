import { WorkflowNodeKind } from "../types/workflow";
import { ProviderCapability } from "../types/provider";

export interface NodeTemplate {
  kind: WorkflowNodeKind;
  title: string;
  description: string;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  danger?: boolean;
  requiresImage?: boolean;
}

export interface ToolbarAction {
  id: string;
  label: string;
  shortcut?: string;
}

export interface SidebarTab {
  id: "canvases" | "assets";
  label: string;
}

export const appCopy = {
  brandName: "WorkFlow",
  brandSubtitle: "AI 图片工作流",
  projectName: "未命名项目",
  currentCanvasName: "画布 1",
  nodeLibraryTitle: "节点库",
  selectedPanelKicker: "节点属性",
  settingsKicker: "设置",
  settingsTitle: "AI 配置",
  emptySelectionTitle: "未选择节点",
  emptySelectionDescription: "选择画布上的节点后编辑参数。",
  emptyProviderTitle: "暂无 API Key",
  emptyProviderDescription: "配置 New API Key 后即可运行 AI 节点。",
  groupTitle: "视觉分组",
  groupDescription: "用于整理和批量移动节点，不参与连线和运行语义。",
};

export const workspaceSidebarCopy = {
  canvasTab: "画布",
  assetsTab: "资产",
  canvasListTitle: "画布列表",
  assetsListTitle: "画布资产",
  allFilter: "全部",
  emptyCanvasTitle: "暂无画布",
  emptyCanvasDescription: "未来支持多画布后会在这里显示画布列表。",
  emptyAssetsTitle: "暂无资产",
  emptyAssetsDescription: "画布中使用到的图片资产会显示在这里。",
  nodeCountSuffix: "节点",
  assetImageFallback: "图片资产",
};

export const nodeLibraryCopy = {
  runAllIdle: "运行全部",
  runAllActive: "运行全部...",
  cancelling: "正在打断",
  cancelRun: "打断运行",
  saveWorkflow: "保存工作流",
  aiSettings: "AI 配置",
};

export const propertyPanelCopy = {
  name: "名称",
  textContent: "文本内容",
  chooseImage: "选择图片",
  imagePath: "图片路径",
  provider: "API",
  providerPlaceholder: "New API",
  model: "模型",
  modelPlaceholder: "选择模型",
  promptOverride: "Prompt 覆盖",
  aspectRatio: "画幅",
  style: "风格",
  seed: "Seed",
  negativePrompt: "负向 Prompt",
  strength: "修改强度",
  saveDirectory: "保存目录",
  run: "运行",
  running: "运行中",
  cancel: "打断",
  cancelling: "正在打断",
  imagePathPlaceholder: "/path/to/image.png",
};

export const nodeSettingsPopoverCopy = {
  modeStyle: "风格",
  modeMark: "标记",
  attachedImage: "输入图",
  runButtonLabel: "运行",
  sendButtonLabel: "提交",
  promptPlaceholder: "可直接输入文字指令，或上传图片输入文字指令对图片进行编辑。",
  providerFallback: "Lib Image",
  qualityLabel: "自适应 · 标准画质",
  cameraLabel: "摄像机",
  sceneLabel: "全景",
  countLabel: "1张",
  stepLabel: "22",
  expandLabel: "展开设置",
};

export const settingsPanelCopy = {
  close: "关闭",
  addProvider: "新增供应商",
  unnamedProvider: "未命名供应商",
  delete: "删除",
  provider: "供应商",
  providerId: "供应商 ID",
  name: "名称",
  providerUrl: "New API 地址",
  providerUrlPlaceholder: "https://api.example.com/v1",
  apiKey: "API Key",
  apiKeyPlaceholder: "sk-...",
  proxyUrl: "代理地址",
  proxyUrlPlaceholder: "http://127.0.0.1:7890",
  modelList: "模型列表",
  addModel: "新增模型",
  modelId: "模型 ID",
  displayName: "显示名称",
  capability: "能力",
  cancel: "取消",
  save: "保存配置",
  modelCountSuffix: "个模型",
  newProviderName: "新供应商",
};

export const settingsValidationCopy = {
  emptyProviderId: "供应商 ID 不能为空",
  duplicateProviderId: "供应商 ID 重复：",
  unnamedProviderFallback: "(未命名)",
  emptyProviderName: "名称不能为空",
  emptyApiKey: "API Key 不能为空",
  emptyModelId: "存在空模型 ID",
  duplicateModel: "模型重复：",
};

export const runStateLabels = {
  queued: "等待",
  running: "运行中",
  cancelled: "已打断",
};

export const nodeCardCopy = {
  previewSuffix: "预览",
  savedPrefix: "已保存/接收：",
};

export const nodeTemplates: NodeTemplate[] = [
  { kind: "textInput", title: "文本输入", description: "提供 prompt 文本" },
  { kind: "imageInput", title: "图片输入", description: "引用本地图片路径" },
  { kind: "textToImage", title: "文生图", description: "文本生成图片" },
  { kind: "imageToImage", title: "图生图", description: "图片与文本编辑" },
  { kind: "output", title: "输出", description: "自动保存上游图片" },
  { kind: "group", title: "分组", description: "整理一组节点" },
];

export const workspaceSidebarTabs: SidebarTab[] = [
  { id: "canvases", label: workspaceSidebarCopy.canvasTab },
  { id: "assets", label: workspaceSidebarCopy.assetsTab },
];

export const capabilityLabels: Record<ProviderCapability, string> = {
  textToImage: "文生图",
  imageToImage: "图生图",
};

export const imageContextMenuActions: ContextMenuAction[] = [
  { id: "save", label: "保存图片", requiresImage: true },
  { id: "copy", label: "复制图片", requiresImage: true },
  { id: "show", label: "在文件夹中显示", requiresImage: true },
  { id: "rerun", label: "重新运行该节点" },
  { id: "delete", label: "删除节点", danger: true },
];

export const edgeContextMenuActions: ContextMenuAction[] = [
  { id: "delete-edge", label: "删除连线", danger: true },
];

export const paneContextMenuActions: ContextMenuAction[] = [
  { id: "add-node", label: "添加节点" },
];

export const nodePickerCopy = {
  title: "添加节点",
  description: "选择要添加到画布的节点类型。",
};

export const canvasToolbarActions: ToolbarAction[] = [
  { id: "fitSelected", label: "定位", shortcut: "F" },
  { id: "fitAll", label: "全景" },
  { id: "autoLayout", label: "自动布局", shortcut: "L" },
  { id: "save", label: "保存", shortcut: "Ctrl S" },
  { id: "settings", label: "AI 配置" },
];

export const aspectRatioOptions = ["1:1", "4:3", "3:4", "16:9", "9:16"];
