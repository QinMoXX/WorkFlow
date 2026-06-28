# WorkFlow 当前设计

## 产品定位

WorkFlow 是本地桌面端节点式 AI 图片工作流工具。当前重点是项目内多画布、项目级资产管理和可重复运行的图片生成链路。

## AI 接入边界

当前不支持多供应商配置。应用统一接入固定 New API Base URL：

```text
https://new-api-production-c695.up.railway.app/v1
```

New API 平台负责上游供应商分发，WorkFlow 只保存一个本地 API Key，并在运行时使用 Bearer Token 调用图片接口。

## 节点模型

当前节点类型：

- `textInput`：提供 prompt 文本。
- `imageInput`：引用项目资产或本地导入图片。
- `imageGeneration`：统一图片生成节点。
- `output`：保存或接收上游图片结果。
- `group`：视觉分组，不参与执行语义。

旧的 `textToImage` 和 `imageToImage` 会在前端加载时迁移为 `imageGeneration`。

## 图片生成接口选择

`imageGeneration` 根据输入自动选择接口：

- 未连接图片输入：调用图模型生图接口 `/images/generations`。
- 连接图片输入：调用图片编辑接口 `/images/edits`。

因此产品层不再拆分“文生图节点”和“图文生图节点”。用户只需要给图片生成节点连接文本和可选图片。

## 项目与资产

应用支持项目列表。一个项目是一个独立文件夹：

```text
workflows/
  projects.json
  projects/
    {projectAssetDir}/
      project.json
      assets/
        imported/
        generated/
        output/
        thumbnails/
```

一个项目可包含多个画布，画布之间共享项目级资产目录。删除画布不会删除项目资产。

资产库能力：

- 搜索。
- 按导入、生成、输出筛选。
- 打开资产所在位置。
- 删除资产文件。
- 拖拽资产到画布，创建图片输入节点。

## 运行前检查

前端在调用后端运行前会先检查：

- API Key 是否为空。
- 图片生成节点是否有 prompt。
- 图片输入节点是否选择了图片。
- 图片生成节点的模型是否在当前白名单中。

后端仍保留连接校验、拓扑排序、模型校验、文件校验和 API 错误处理作为最终兜底。

## 暂不实现

当前移除了未实现的生成图工具栏选项，例如全景、多角度、打光、高清、宫格切分、编辑和展开。后续明确具体能力和 API 参数后再重新设计入口。
