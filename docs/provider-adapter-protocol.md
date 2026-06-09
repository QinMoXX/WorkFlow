# Provider Adapter 协议

本文说明 WorkFlow 当前图片 Provider Adapter 需要供应商实现或兼容的 HTTP 协议。当前后端实现位于 `src-tauri/src/workflow/image_provider.rs`，协议风格参考 Agnes AI 的 `agnes-image-2.0-flash` 图片接口。

## 配置字段

Provider 配置由前端和后端共同使用，字段名采用 camelCase：

```json
{
  "id": "agnes",
  "name": "Agnes AI",
  "baseUrl": "https://apihub.agnes-ai.com/v1",
  "apiKey": "YOUR_API_KEY",
  "proxyUrl": "",
  "models": [
    {
      "id": "agnes-image-2.0-flash",
      "name": "Agnes Image 2.0 Flash",
      "capability": "textToImage"
    },
    {
      "id": "agnes-image-2.0-flash",
      "name": "Agnes Image 2.0 Flash Edit",
      "capability": "imageToImage"
    }
  ]
}
```

- `id`：供应商稳定 ID，节点通过它引用供应商。
- `name`：界面展示名。
- `baseUrl`：供应商 API 根地址。
- `apiKey`：Bearer Token。
- `proxyUrl`：可选代理地址。
- `models`：供应商可选模型列表，每个模型声明能力类型。

模型能力只支持：

- `textToImage`：文生图节点可选择。
- `imageToImage`：图生图节点可选择。

## Base URL 拼接规则

Adapter 不要求用户在配置中填写完整 endpoint，只填写 `baseUrl`。运行时统一拼接图片生成 endpoint：

```text
{trimmedBaseUrlWithoutTrailingSlash}/images/generations
```

规则：

- 先对 `baseUrl` 执行首尾空白裁剪。
- 再移除末尾 `/`。
- 最后追加 `/images/generations`。

示例：

```text
https://apihub.agnes-ai.com/v1
-> https://apihub.agnes-ai.com/v1/images/generations

https://apihub.agnes-ai.com/v1/
-> https://apihub.agnes-ai.com/v1/images/generations
```

不要把 `/images/generations` 写进 `baseUrl`，否则会拼出重复路径。

## 必须支持的 Endpoint

当前 Provider Adapter 只要求图片供应商支持一个 endpoint：

```http
POST /images/generations
Authorization: Bearer <apiKey>
Content-Type: application/json
```

完整 URL 由 `baseUrl` 拼接得到。文生图和图生图都会调用这个 endpoint，通过请求体区分能力。

当前没有调用以下 endpoint：

- `GET /models`
- `POST /images/edits`
- `POST /images/variations`
- 供应商自定义上传 endpoint

模型列表由用户在 AI 设置中手动配置。

## 文生图请求体

文生图节点调用 `POST /images/generations`，请求体如下：

```json
{
  "model": "agnes-image-2.0-flash",
  "prompt": "A cinematic product photo of a white ceramic mug on a walnut desk",
  "size": "1024x1024",
  "seed": 12345,
  "extra_body": {
    "response_format": "url"
  }
}
```

字段说明：

- `model`：必填，来自节点选择的模型 ID。
- `prompt`：必填，来自连接的文本输入或节点自身 prompt。
- `size`：可选，由节点画幅转换得到。
- `seed`：可选，用户填写 seed 时发送整数。
- `extra_body.response_format`：当前固定发送 `"url"`，表示优先请求 URL 响应。

当 `size` 或 `seed` 为空时，字段不会出现在 JSON 中。

当前画幅到 `size` 的转换：

```text
1:1  -> 1024x1024
4:3  -> 1024x768
3:4  -> 768x1024
16:9 -> 1024x576
9:16 -> 576x1024
```

## 图生图请求体

图生图节点同样调用 `POST /images/generations`，请求体如下：

```json
{
  "model": "agnes-image-2.0-flash",
  "prompt": "Keep the same composition, turn the scene into watercolor style",
  "size": "1024x1024",
  "seed": 12345,
  "tags": ["img2img"],
  "extra_body": {
    "image": [
      "https://example.com/input.png"
    ],
    "response_format": "url"
  }
}
```

字段说明：

- `model`：必填，来自节点选择的模型 ID。
- `prompt`：必填，来自连接的文本输入或节点自身 prompt。
- `size`：可选，由节点画幅转换得到。
- `seed`：可选，用户填写 seed 时发送整数。
- `tags`：图生图固定发送 `["img2img"]`。
- `extra_body.image`：必填，图片输入数组。
- `extra_body.response_format`：当前固定发送 `"url"`，表示优先请求 URL 响应。

`extra_body.image` 的来源规则：

- 如果上游 AI 节点有 `resultUrl`，优先使用该远程 URL。
- 如果输入本身是 `http://` 或 `https://`，原样发送。
- 如果输入本身是 `data:image/...`，原样发送。
- 如果输入是本地文件路径，后端读取文件并转成 `data:image/<type>;base64,<content>`。

本地文件转 data URL 时支持的格式：

- `jpg`
- `jpeg`
- `png`
- `webp`
- `gif`

注意：Agnes 文档示例使用图片 URL。当前实现为了支持本地图片输入，会把本地文件转换为 data URL；如果某个供应商只接受公网可访问 URL，需要增加上传或对象存储步骤，不能只靠当前 Adapter 完成。

## 响应格式

供应商响应必须是 OpenAI-compatible 图片响应结构：

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
      "b64_json": "iVBORw0KGgoAAAANSUhEUg..."
    }
  ]
}
```

解析规则：

- 必须存在 `data[0]`。
- 如果 `data[0].url` 存在，后端会下载该 URL 对应的图片并保存到 `appData/assets/generated/`。
- 如果 `data[0].url` 不存在但 `data[0].b64_json` 存在，后端会把 base64 解码为 PNG 并保存到 `appData/assets/generated/`。
- 如果两个字段都不存在，请求会失败并提示“图片 API 响应缺少 data[0].url 或 data[0].b64_json”。

虽然当前请求体固定设置 `extra_body.response_format` 为 `"url"`，但 Adapter 已兼容供应商返回 `b64_json` 的情况。

## proxyUrl 用法

`proxyUrl` 是 Provider 级别的可选 HTTP 代理配置。它只影响该供应商的请求客户端，不是 API endpoint，也不会参与 `baseUrl` 拼接。

启用条件：

- `proxyUrl` 字段存在。
- 去掉首尾空白后不为空。

启用后，后端会把它传给 `reqwest::Proxy::all(proxyUrl)`。因此它会作用于该 Provider 客户端发出的 HTTP/HTTPS 请求，包括：

- `POST {baseUrl}/images/generations`
- 下载 `data[0].url` 返回的远程图片
- 公网 DNS 兜底重试后的图片 API 请求客户端

示例：

```json
{
  "proxyUrl": "http://127.0.0.1:7890"
}
```

带认证的代理可以使用 URL 内嵌认证信息，具体格式取决于代理服务和 `reqwest` 支持情况：

```json
{
  "proxyUrl": "http://user:password@127.0.0.1:7890"
}
```

如果 `proxyUrl` 格式无效，HTTP 客户端创建会失败，运行日志会提示“代理地址无效”。

## 错误和兼容边界

Provider Adapter 当前假设供应商满足以下兼容要求：

- 使用 Bearer Token 鉴权。
- 接受 JSON 请求体。
- 支持 `POST /images/generations`。
- 文生图接受 `model`、`prompt`、可选 `size`、可选 `seed`。
- 图生图接受 `tags: ["img2img"]` 和 `extra_body.image`。
- 响应包含 `data[0].url` 或 `data[0].b64_json`。

如果供应商使用不同 endpoint、不同鉴权方式、multipart 上传、异步任务轮询、不同响应字段，应该新增单独 Adapter，而不是把差异塞进当前 OpenAI-compatible Adapter。
