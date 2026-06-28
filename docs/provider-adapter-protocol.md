# New API 图片接口协议

当前版本不再维护多供应商 Provider 配置。WorkFlow 固定调用 New API：

```text
https://new-api-production-c695.up.railway.app/v1
```

应用内只保存一个 API Key，后端运行时使用：

```http
Authorization: Bearer <apiKey>
```

## 文本生图

当 `imageGeneration` 节点没有图片输入时，后端调用：

```http
POST /images/generations
Content-Type: application/json
```

请求体：

```json
{
  "model": "gpt-image-1",
  "prompt": "A clean product photo",
  "size": "1024x1024",
  "seed": 12345
}
```

`size` 由画幅映射得到，`seed` 为空时不发送。

## 图文生图 / 图片编辑

当 `imageGeneration` 节点连接了图片输入时，后端调用：

```http
POST /images/edits
Content-Type: multipart/form-data
```

表单字段：

- `model`
- `prompt`
- `image`
- `size`，可选
- `seed`，可选

图片来源支持：

- 项目内本地图片。
- `data:image/...;base64,...`。
- HTTP(S) 图片 URL，后端会先下载后作为 multipart 图片提交。

## 响应格式

接口需要返回 OpenAI 风格图片响应：

```json
{
  "data": [
    {
      "url": "https://example.com/generated.png"
    }
  ]
}
```

也支持 `b64_json`：

```json
{
  "data": [
    {
      "b64_json": "..."
    }
  ]
}
```

后端会将结果保存到当前项目的 `assets/generated/` 目录。

## 模型白名单

文生图可用：

- `agnes-image-2.0-flash`
- `gpt-image-1`
- `qwen-image-2.0-pro`
- `qwen-image-2.0`
- `qwen-image-max`

图文生图/图片编辑可用：

- `qwen-image-2.0-pro`
- `qwen-image-2.0`

## 已移除内容

以下能力当前不再支持：

- 多供应商配置。
- 用户自定义 Base URL。
- 供应商级代理配置。
- 手动维护 ProviderConfig 模型列表。
