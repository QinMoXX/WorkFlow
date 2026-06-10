# WorkFlow 前端样式风格标准

本文档基于 `docs/参考图/` 中的应用案例素材整理，用于指导 WorkFlow 的 React/Tauri 前端视觉设计与组件实现。

## 1. 风格定位

WorkFlow 是节点式 AI 图片工作流桌面应用。界面应服务于长期编辑、调参和结果对比，优先保证画布可读性、节点关系清晰、图片资产突出。

推荐主风格为「暗色专业工作台」：

- 深色无限画布作为主场景，降低长时间创作的视觉疲劳。
- 图片结果、节点选中态、运行按钮和连线高亮作为主要视觉焦点。
- 工具栏、属性面板、资产库使用悬浮层或侧边抽屉形态，保持画布空间完整。
- 整体质感克制、偏专业，不使用大面积营销式渐变、装饰图形或厚重拟物阴影。

浅色工作流案例图可作为辅助主题，适合用于空状态、模板预览、教程示例或导出展示页，不建议作为主编辑器默认视觉。

## 2. 参考图归纳

### 暗色编辑器素材

暗色素材呈现出更接近目标产品的形态：

- 背景是近黑色画布，带低对比度点阵网格。
- 顶部使用悬浮圆角工具条，按钮以图标加短文本为主。
- 节点以图片卡片、输入框、参数面板、资产库抽屉为核心。
- 连线是浅灰到蓝色的柔和曲线，端口为小圆点，选中或连接时发光。
- 右侧资产库是半透明深色面板，内部图片卡片密集排列。
- 运行区强调大输入框和明确的「运行」按钮，按钮使用浅色实心填充。

### 浅色工作流素材

浅色素材更适合展示完整工作流：

- 背景接近白色，使用非常淡的点阵网格。
- 节点卡片为白底、轻阴影、大圆角。
- 标题使用大写英文标签，如 `IMAGE`、`PROMPT`、`OUTPUT`。
- 中央处理节点更大，承载 tabs、prompt、图片输入和运行按钮。
- 输出节点突出图片瀑布或网格结果。

## 3. 设计原则

- 画布优先：默认视图中，画布面积不应被固定面板过度占用。
- 图片优先：图片节点的预览区域应比文本说明更醒目。
- 信息密度适中：桌面端允许紧凑控件，但输入区域和图片卡片要保留足够点击空间。
- 层级靠明暗和边框表达，少用大阴影。
- 所有圆角保持统一，避免从小按钮到大面板都过度圆润。
- 状态必须可见：选中、hover、运行中、成功、错误、禁用都要有明确视觉反馈。

## 4. 色彩系统

### 主暗色主题

```css
:root {
  --color-bg-app: #0b0f14;
  --color-bg-canvas: #0d1218;
  --color-bg-panel: #121922;
  --color-bg-panel-raised: #161f2a;
  --color-bg-control: #1b2430;
  --color-bg-control-hover: #222d3a;
  --color-bg-inverse: #eef3f8;

  --color-border-subtle: #24303d;
  --color-border-default: #334253;
  --color-border-strong: #52657a;

  --color-text-primary: #edf3f8;
  --color-text-secondary: #aeb9c6;
  --color-text-muted: #6f7c8b;
  --color-text-inverse: #111821;

  --color-accent: #61b7ff;
  --color-accent-strong: #2f91ff;
  --color-accent-soft: rgba(97, 183, 255, 0.18);

  --color-success: #4fd19b;
  --color-warning: #f0b45f;
  --color-danger: #ff6b7a;
  --color-new: #31c6df;
}
```

### 浅色辅助主题

```css
:root[data-theme="light"] {
  --color-bg-app: #f6f8fb;
  --color-bg-canvas: #f8fbff;
  --color-bg-panel: #ffffff;
  --color-bg-panel-raised: #ffffff;
  --color-bg-control: #f1f5f9;
  --color-bg-control-hover: #e9eff6;
  --color-bg-inverse: #101725;

  --color-border-subtle: #e4eaf1;
  --color-border-default: #d3dce7;
  --color-border-strong: #9aa8b7;

  --color-text-primary: #17202c;
  --color-text-secondary: #5f6d7d;
  --color-text-muted: #98a4b3;
  --color-text-inverse: #ffffff;
}
```

### 使用规则

- 默认编辑器使用暗色主题。
- 图片预览区域不叠加强色滤镜，避免影响用户判断生成结果。
- 主操作按钮可用浅色实心样式，突出于暗色画布。
- 危险操作只在菜单项、确认弹窗或错误状态中使用红色，不作为装饰色。
- `--color-accent` 只用于选中态、连线高亮、焦点环和少量关键状态。

## 5. 字体与文字层级

字体栈：

```css
font-family:
  Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
```

层级建议：

| 用途 | 字号 | 行高 | 字重 | 说明 |
| --- | ---: | ---: | ---: | --- |
| 画布工具栏文字 | 13px | 18px | 600 | 图标旁短标签 |
| 节点标题 | 12px | 16px | 760 | 可使用大写英文或中文短标题 |
| 面板标题 | 15px | 22px | 700 | 资产库、属性面板标题 |
| 正文/表单 | 13px | 20px | 450 | prompt、说明、字段值 |
| 辅助信息 | 11px | 16px | 500 | 文件名、状态、meta |
| 按钮文字 | 13px | 18px | 650 | 主按钮可 14px |

文字不使用负字距。标题可以使用 `letter-spacing: 0.08em` 表达工具型标签，但仅限短英文标签。

## 6. 空间与圆角

间距采用 4px 基准：

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
```

圆角：

```css
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-pill: 999px;
```

使用规则：

- 节点卡片：`12px`。
- 图片缩略图：`8px`。
- 输入框、选择器、菜单项：`8px`。
- 悬浮工具栏、抽屉面板：`14px` 到 `16px`。
- 普通卡片不要超过 `12px`，避免所有组件都呈现胶囊感。

## 7. 画布

### 背景

暗色画布应使用细点阵网格：

```css
.workflow-canvas {
  background-color: var(--color-bg-canvas);
  background-image: radial-gradient(
    circle,
    rgba(126, 151, 178, 0.16) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
}
```

浅色画布：

```css
[data-theme="light"] .workflow-canvas {
  background-image: radial-gradient(
    circle,
    rgba(120, 145, 170, 0.18) 1px,
    transparent 1px
  );
}
```

### 连线

- 默认连线：`#7f8fa3`，宽度 `2px`，透明度约 `0.72`。
- 选中连线：`--color-accent`，宽度 `2.5px`，可带轻微发光。
- 运行中连线：使用蓝色流动虚线或沿线光点，但动画应低频、克制。
- 连线端口：直径 `10px` 到 `12px`，深色填充，浅色描边。

## 8. 应用布局

推荐主编辑器布局：

```text
┌──────────────────────────────────────────────┐
│               悬浮顶部工具栏                  │
│                                              │
│  节点/图片卡片       工作流画布      右侧资产库 │
│                                              │
│         运行面板 / 属性面板 / 上下文浮层        │
└──────────────────────────────────────────────┘
```

实现建议：

- 左侧节点库默认可折叠，不长期占据大宽度。
- 右侧资产库宽度建议 `320px` 到 `360px`，可收起。
- 属性编辑优先采用选中节点旁的浮层或右侧面板，不要同时出现多个重型面板。
- 顶部工具栏应悬浮在画布上，宽度由内容决定，位置靠左上或居中上方。
- 底部日志默认折叠为状态条，错误时展开或 toast 提示。

## 9. 核心组件规范

### 节点卡片

节点由标题区、主体区、状态区和端口组成。

建议尺寸：

- 文本/Prompt 节点：`240px` 到 `320px` 宽。
- 图片输入节点：`220px` 到 `280px` 宽。
- AI 处理节点：`420px` 到 `560px` 宽。
- 输出节点：`320px` 到 `480px` 宽。

视觉规则：

- 背景：`--color-bg-panel`。
- 边框：`1px solid var(--color-border-default)`。
- 阴影：暗色中仅使用轻微外发光，避免厚重投影。
- 选中态：边框切换为 `--color-accent`，外层 `box-shadow: 0 0 0 3px var(--color-accent-soft)`。
- 节点标题使用短标签，右上角放关闭、删除或更多操作图标。

### 图片节点

- 图片是主内容，宽高比固定，避免加载后布局跳动。
- 竖图推荐 `3 / 4`，横图推荐 `4 / 3`，输出网格使用 `1 / 1` 或原始比例裁切。
- 图片右上角可放导出、预览、删除等悬浮图标按钮。
- 文件名只显示一行，超出省略。

### AI 处理节点

AI 节点应承载主要参数：

- 顶部：模型/供应商选择 + 模式 tabs。
- 中部：prompt 输入区。
- 附近：输入图片缩略图列表，按连接顺序编号。
- 底部：高级参数胶囊控件 + 运行按钮。

运行按钮在暗色主题中可使用浅色实心按钮：

```css
.run-button {
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-bg-inverse);
  color: var(--color-text-inverse);
  font-weight: 700;
}
```

### 资产库

资产库是右侧抽屉，主要用于图片素材管理。

- 面板背景：`rgba(18, 25, 34, 0.94)`。
- 宽度：`336px`。
- 顶部：标题、收起按钮、分段控件。
- 内容：图片网格，两列布局，间距 `10px` 到 `12px`。
- 图片卡片下方显示名称，右侧使用编辑、删除等图标按钮。
- 拖拽上传区域使用虚线边框和低对比文案。

### 悬浮工具栏

工具栏用于画布级操作：

- 高度：`44px` 到 `52px`。
- 背景：`rgba(31, 31, 31, 0.92)` 或 `--color-bg-panel-raised`。
- 边框：`1px solid rgba(255, 255, 255, 0.10)`。
- 圆角：`12px`。
- 图标尺寸：`16px` 到 `18px`。
- 分组之间使用竖向分隔线。
- 新功能标签使用青色小胶囊，如 `NEW`。

### 上下文菜单

- 背景比面板略高一层。
- 宽度根据内容，最小 `180px`。
- 菜单项高度 `34px` 到 `38px`。
- 左侧放图标，右侧可放快捷键。
- hover 背景使用 `--color-bg-control-hover`。

## 10. 表单控件

输入框：

- 高度：`36px` 到 `40px`。
- 大 prompt 输入区最小高度 `128px`。
- 背景使用 `--color-bg-control`。
- 边框默认低对比，focus 使用蓝色焦点环。

分段控件：

- 用于图片/视频、文生图/图生图、资产/工作流等模式切换。
- 外层为暗色描边容器，选中项使用浅色实心或更高亮背景。

滑块：

- 用于强度、比例、步数、相似度等连续参数。
- 轨道低对比，已选区使用 `--color-accent`。
- 数值显示在右侧，便于精确调整。

## 11. 状态规范

| 状态 | 视觉表达 |
| --- | --- |
| 默认 | 低对比边框，无强光效 |
| Hover | 背景提高一级，边框略亮 |
| Focus | `--color-accent` 焦点环，必须键盘可见 |
| Selected | 蓝色边框 + 轻外环 |
| Running | 节点状态 badge 使用 warning 色，连线可低频流动 |
| Success | 使用绿色状态点或 badge，不铺满大面积绿色 |
| Error | 红色状态点、错误摘要和可展开详情 |
| Disabled | 透明度降低，禁止 hover 强反馈 |

## 12. 动效

动效只用于帮助理解状态变化：

- 面板展开/收起：`160ms` 到 `220ms`。
- hover/focus 过渡：`120ms` 到 `160ms`。
- 节点拖拽不添加惯性动画，保证操作精确。
- 运行中可使用缓慢脉冲或连线流动，避免高频闪烁。

统一缓动：

```css
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--duration-fast: 140ms;
--duration-normal: 200ms;
```

## 13. 图标与图片

- 图标优先使用 `lucide-react`，保持线性图标风格一致。
- 图标按钮必须有 tooltip 或 `aria-label`。
- 图片缩略图不使用重滤镜，不裁掉主体脸部或主要内容。
- 上传、下载、复制、删除、放大、运行等操作使用熟悉图标，不用文字胶囊替代。

## 14. 响应式与桌面适配

WorkFlow 是桌面应用，优先适配 `1280px` 以上宽度。

- `>= 1440px`：右侧资产库可常驻，属性面板可浮动。
- `1024px - 1439px`：右侧资产库默认收起，点击按钮展开。
- `< 1024px`：使用单画布视图，节点库、资产库、属性面板都作为抽屉。
- 任何宽度下，工具栏文字不得溢出按钮；必要时只保留图标和 tooltip。

## 15. 可访问性

- 交互控件必须支持键盘 focus。
- 文本与背景对比度应满足 WCAG AA。
- 错误状态不能只依赖颜色，需要配合图标或文案。
- 图片操作按钮需要 `aria-label`。
- 拖拽上传区域也应支持点击选择文件。

## 16. 前端落地建议

建议按以下顺序落地：

1. 在 `src/App.css` 中建立 design tokens，并将现有颜色替换为变量。
2. 将默认画布切换为暗色点阵背景。
3. 重构节点卡片：统一边框、圆角、选中态、图片预览比例。
4. 将节点库和供应商设置从固定三栏逐步改为可折叠面板或浮层。
5. 增加悬浮顶部工具栏，承载运行、布局、缩放、导入导出等画布操作。
6. 增加右侧资产库抽屉，承载本地输入图、生成图和历史结果。
7. 为 hover、focus、selected、running、error 状态补齐样式。

## 17. CSS 基础模板

```css
:root {
  color: var(--color-text-primary);
  background: var(--color-bg-app);
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  overflow: hidden;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

## 18. 质量检查清单

提交 UI 变更前检查：

- 暗色画布中节点、连线、端口是否一眼可分辨。
- 图片预览是否固定比例，加载前后是否不跳动。
- 工具栏、菜单、面板是否存在文字溢出。
- 选中、hover、focus、运行中、错误状态是否完整。
- 右侧资产库展开时是否遮挡关键节点操作。
- 浅色主题是否只作为辅助，不与主编辑器风格混用。
- 所有图标按钮是否有 tooltip 或 `aria-label`。
