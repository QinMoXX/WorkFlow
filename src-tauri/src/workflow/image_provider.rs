use std::{
    error::Error,
    fs,
    net::{IpAddr, SocketAddr},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use reqwest::{blocking::Client, blocking::Response, Proxy, Url};
use serde::{Deserialize, Serialize};

use super::providers::ProviderConfig;

pub struct TextToImageInput {
    pub node_id: String,
    pub model: String,
    pub prompt: String,
    pub size: Option<String>,
    pub seed: Option<i64>,
}

pub struct ImageToImageInput {
    pub node_id: String,
    pub model: String,
    pub prompt: String,
    pub image_source: String,
    pub size: Option<String>,
    pub seed: Option<i64>,
}

pub struct ImageResult {
    pub remote_url: String,
    pub local_path: String,
}

pub trait ImageProvider {
    fn text_to_image(&self, input: TextToImageInput) -> Result<ImageResult, String>;
    fn image_to_image(&self, input: ImageToImageInput) -> Result<ImageResult, String>;
}

pub struct OpenAiCompatibleImageProvider<'a> {
    provider: &'a ProviderConfig,
    generated_dir: &'a Path,
    client: Client,
}

#[derive(Debug, Serialize)]
struct ImageGenerationRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    extra_body: Option<ImageGenerationExtraBody>,
}

#[derive(Debug, Serialize)]
struct ImageGenerationExtraBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    image: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationResponse {
    data: Vec<ImageGenerationData>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationData {
    url: Option<String>,
    b64_json: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DnsResponse {
    #[serde(rename = "Answer")]
    answer: Option<Vec<DnsAnswer>>,
}

#[derive(Debug, Deserialize)]
struct DnsAnswer {
    #[serde(rename = "type")]
    record_type: u16,
    data: String,
}

impl<'a> OpenAiCompatibleImageProvider<'a> {
    pub fn new(provider: &'a ProviderConfig, generated_dir: &'a Path) -> Result<Self, String> {
        Ok(Self {
            provider,
            generated_dir,
            client: build_client(provider, None)?,
        })
    }

    fn create_image(
        &self,
        node_id: &str,
        request: ImageGenerationRequest,
    ) -> Result<ImageResult, String> {
        let base_url = self.provider.base_url.trim();
        if base_url.is_empty() {
            return Err(format!("供应商 {} 缺少 API URL", self.provider.name));
        }
        let endpoint = format!("{}/images/generations", base_url.trim_end_matches('/'));
        Url::parse(&endpoint)
            .map_err(|error| format!("图片 API 地址无效：{}；原因：{}", endpoint, error))?;

        let response = self
            .send_image_request(&endpoint, &request)
            .or_else(|error| {
                if should_retry_with_public_dns(&error) {
                    let fallback_client =
                        build_public_dns_fallback_client(self.provider, &endpoint).map_err(
                            |fallback_error| {
                                format!(
                                    "图片 API 请求失败：{}；公网 DNS 兜底失败：{}",
                                    error_chain(&error),
                                    fallback_error
                                )
                            },
                        )?;
                    return self
                        .send_image_request_with_client(&fallback_client, &endpoint, &request)
                        .map_err(|retry_error| {
                            format!(
                                "图片 API 请求失败：{}；公网 DNS 兜底重试失败：{}",
                                error_chain(&error),
                                error_chain(&retry_error)
                            )
                        });
                }
                Err(format!("图片 API 请求失败：{}", error_chain(&error)))
            })?;

        let status = response.status();
        if !status.is_success() {
            let body = response
                .text()
                .unwrap_or_else(|error| format!("读取错误响应内容失败：{}", error_chain(&error)));
            return Err(format!(
                "图片 API 返回错误 {}：{}",
                status,
                truncate_value(&body, 600)
            ));
        }

        let body: ImageGenerationResponse = response
            .json()
            .map_err(|error| format!("图片 API 响应解析失败：{}", error_chain(&error)))?;
        let data = body
            .data
            .first()
            .ok_or_else(|| "图片 API 响应缺少 data[0]".to_string())?;

        let (remote_url, local_path) = if let Some(remote_url) = data.url.clone() {
            let local_path = self.download_image(node_id, &remote_url)?;
            (remote_url, local_path)
        } else if let Some(b64_json) = data.b64_json.as_deref() {
            let local_path = self.save_base64_image(node_id, b64_json)?;
            ("".to_string(), local_path)
        } else {
            return Err("图片 API 响应缺少 data[0].url 或 data[0].b64_json".to_string());
        };

        Ok(ImageResult {
            remote_url,
            local_path,
        })
    }

    fn download_image(&self, node_id: &str, remote_url: &str) -> Result<String, String> {
        Url::parse(remote_url).map_err(|error| {
            format!(
                "图片 API 返回的图片 URL 无效：{}；原因：{}",
                remote_url, error
            )
        })?;
        fs::create_dir_all(self.generated_dir).map_err(|error| {
            format!(
                "创建生成图片目录失败：{}；原因：{}",
                self.generated_dir.display(),
                error
            )
        })?;

        let response = self.client.get(remote_url).send().map_err(|error| {
            format!(
                "下载生成图片失败：{}；原因：{}",
                remote_url,
                error_chain(&error)
            )
        })?;
        let status = response.status();
        if !status.is_success() {
            return Err(format!("下载生成图片返回错误 {}：{}", status, remote_url));
        }

        let extension = image_extension(response.headers().get(reqwest::header::CONTENT_TYPE));
        let bytes = response
            .bytes()
            .map_err(|error| format!("读取生成图片内容失败：{}", error_chain(&error)))?;
        let path = self
            .generated_dir
            .join(result_file_name(node_id, extension)?);
        fs::write(&path, bytes)
            .map_err(|error| format!("保存生成图片失败：{}；原因：{}", path.display(), error))?;

        Ok(path.to_string_lossy().into_owned())
    }

    fn save_base64_image(&self, node_id: &str, b64_json: &str) -> Result<String, String> {
        fs::create_dir_all(self.generated_dir).map_err(|error| {
            format!(
                "创建生成图片目录失败：{}；原因：{}",
                self.generated_dir.display(),
                error
            )
        })?;
        let bytes = BASE64_STANDARD
            .decode(b64_json)
            .map_err(|error| format!("解析 base64 图片失败：{}", error))?;
        let path = self.generated_dir.join(result_file_name(node_id, "png")?);
        fs::write(&path, bytes).map_err(|error| {
            format!("保存 base64 图片失败：{}；原因：{}", path.display(), error)
        })?;

        Ok(path.to_string_lossy().into_owned())
    }

    fn send_image_request(
        &self,
        endpoint: &str,
        request: &ImageGenerationRequest,
    ) -> Result<Response, reqwest::Error> {
        self.send_image_request_with_client(&self.client, endpoint, request)
    }

    fn send_image_request_with_client(
        &self,
        client: &Client,
        endpoint: &str,
        request: &ImageGenerationRequest,
    ) -> Result<Response, reqwest::Error> {
        client
            .post(endpoint)
            .bearer_auth(self.provider.api_key.trim())
            .json(request)
            .send()
    }
}

impl ImageProvider for OpenAiCompatibleImageProvider<'_> {
    fn text_to_image(&self, input: TextToImageInput) -> Result<ImageResult, String> {
        self.create_image(
            &input.node_id,
            ImageGenerationRequest {
                model: input.model,
                prompt: input.prompt,
                size: input.size,
                seed: input.seed,
                tags: None,
                extra_body: Some(ImageGenerationExtraBody {
                    image: None,
                    response_format: Some("url".to_string()),
                }),
            },
        )
    }

    fn image_to_image(&self, input: ImageToImageInput) -> Result<ImageResult, String> {
        self.create_image(
            &input.node_id,
            ImageGenerationRequest {
                model: input.model,
                prompt: input.prompt,
                size: input.size,
                seed: input.seed,
                tags: Some(vec!["img2img".to_string()]),
                extra_body: Some(ImageGenerationExtraBody {
                    image: Some(vec![input.image_source]),
                    response_format: Some("url".to_string()),
                }),
            },
        )
    }
}

fn image_extension(content_type: Option<&reqwest::header::HeaderValue>) -> &'static str {
    match content_type.and_then(|value| value.to_str().ok()) {
        Some(value) if value.contains("jpeg") || value.contains("jpg") => "jpg",
        Some(value) if value.contains("webp") => "webp",
        Some(value) if value.contains("gif") => "gif",
        _ => "png",
    }
}

fn result_file_name(node_id: &str, extension: &str) -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    Ok(PathBuf::from(format!(
        "{}_{}.{}",
        sanitize_node_id(node_id),
        timestamp,
        extension
    )))
}

fn sanitize_node_id(node_id: &str) -> String {
    node_id
        .chars()
        .map(|value| {
            if value.is_ascii_alphanumeric() || value == '-' || value == '_' {
                value
            } else {
                '_'
            }
        })
        .collect()
}

fn error_chain(error: &dyn Error) -> String {
    let mut parts = vec![error.to_string()];
    let mut source = error.source();
    while let Some(next) = source {
        parts.push(next.to_string());
        source = next.source();
    }
    parts.join("；原因：")
}

fn build_client(
    provider: &ProviderConfig,
    resolved_endpoint: Option<(&str, SocketAddr)>,
) -> Result<Client, String> {
    let mut client_builder = Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(20))
        .http1_only();

    if let Some(proxy_url) = provider
        .proxy_url
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        let proxy = Proxy::all(proxy_url.trim())
            .map_err(|error| format!("代理地址无效：{}", error_chain(&error)))?;
        client_builder = client_builder.proxy(proxy);
    }

    if let Some((host, address)) = resolved_endpoint {
        client_builder = client_builder.resolve(host, address);
    }

    client_builder
        .build()
        .map_err(|error| format!("创建 HTTP 客户端失败：{}", error_chain(&error)))
}

fn build_public_dns_fallback_client(
    provider: &ProviderConfig,
    endpoint: &str,
) -> Result<Client, String> {
    let url = Url::parse(endpoint)
        .map_err(|error| format!("图片 API 地址无效：{}；原因：{}", endpoint, error))?;
    let host = url
        .host_str()
        .ok_or_else(|| "API 地址缺少 host".to_string())?;
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "API 地址缺少端口".to_string())?;
    let ip = resolve_public_ipv4(host)?;

    build_client(
        provider,
        Some((host, SocketAddr::new(IpAddr::V4(ip), port))),
    )
}

fn truncate_value(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let truncated: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        format!("{}...", truncated)
    } else {
        truncated
    }
}

fn resolve_public_ipv4(host: &str) -> Result<std::net::Ipv4Addr, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("创建 DNS 客户端失败：{}", error_chain(&error)))?;
    let response = client
        .get("https://cloudflare-dns.com/dns-query")
        .header(reqwest::header::ACCEPT, "application/dns-json")
        .query(&[("name", host), ("type", "A")])
        .send()
        .map_err(|error| format!("公网 DNS 查询失败：{}", error_chain(&error)))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("公网 DNS 查询返回错误：{}", status));
    }

    let body: DnsResponse = response
        .json()
        .map_err(|error| format!("公网 DNS 响应解析失败：{}", error_chain(&error)))?;
    body.answer
        .unwrap_or_default()
        .into_iter()
        .find(|answer| answer.record_type == 1)
        .and_then(|answer| answer.data.parse().ok())
        .ok_or_else(|| format!("公网 DNS 未返回 {} 的 A 记录", host))
}

fn should_retry_with_public_dns(error: &reqwest::Error) -> bool {
    let message = error_chain(error);
    message.contains("client error (Connect)")
        || message.contains("tls handshake eof")
        || message.contains("unexpected eof")
}
