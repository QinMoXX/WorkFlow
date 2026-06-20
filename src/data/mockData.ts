import { WorkflowNodeKind } from "../types/workflow";

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
  settingsKicker: "设置",
  settingsTitle: "AI 配置",
};

export const workspaceSidebarCopy = {
  canvasTab: "画布",
  assetsTab: "资产",
  canvasListTitle: "画布列表",
  assetsListTitle: "画布资产",
  assetRootTitle: "资源根目录",
  createCanvas: "新建画布",
  collapseSidebar: "折叠侧边栏",
  renameCanvas: "重命名",
  deleteCanvas: "删除",
  openCanvasDir: "打开目录",
  chooseAssetRoot: "选择资源根目录",
  resetAssetRoot: "恢复默认资源根目录",
  defaultAssetRoot: "默认应用数据目录",
  allFilter: "全部",
  emptyCanvasTitle: "暂无画布",
  emptyCanvasDescription: "点击加号创建新画布。",
  emptyAssetsTitle: "暂无资产",
  emptyAssetsDescription: "画布中使用到的图片资产会显示在这里。",
  nodeCountSuffix: "节点",
  assetImageFallback: "图片资产",
};

export const propertyPanelCopy = {
  name: "名称",
  chooseImage: "选择图片",
  imagePath: "图片路径",
  model: "模型",
  saveDirectory: "保存目录",
  cancel: "打断",
  cancelling: "正在打断",
  imagePathPlaceholder: "/path/to/image.png",
  strength: "修改强度",
  run: "运行",
  running: "运行中",
};

export const nodeSettingsPopoverCopy = {
  modeStyle: "风格",
  modeMark: "标记",
  sendButtonLabel: "提交",
  promptPlaceholder: "可直接输入文字指令，或上传图片输入文字指令对图片进行编辑。",
  cameraLabel: "摄像机",
  sceneLabel: "全景",
  countLabel: "1张",
  stepLabel: "22",
  expandLabel: "展开设置",
};

export const settingsPanelCopy = {
  close: "关闭",
  providerUrl: "API 地址",
  apiKey: "API Key",
  apiKeyPlaceholder: "sk-...",
  cancel: "取消",
  save: "保存配置",
};

export const settingsValidationCopy = {
  emptyApiKey: "API Key 不能为空",
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
  { kind: "imageGeneration", title: "图片生成", description: "有图片输入时自动执行图生图" },
  { kind: "output", title: "输出", description: "自动保存上游图片" },
  { kind: "group", title: "分组", description: "整理一组节点" },
];

export const workspaceSidebarTabs: SidebarTab[] = [
  { id: "canvases", label: workspaceSidebarCopy.canvasTab },
  { id: "assets", label: workspaceSidebarCopy.assetsTab },
];

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
  { id: "settings", label: "API Key" },
];

export const aspectRatioOptions = ["1:1", "4:3", "3:4", "16:9", "9:16"];
