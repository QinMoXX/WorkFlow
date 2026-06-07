use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use reqwest::blocking::Client;
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
    pub image_url: String,
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
    response_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    image: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationResponse {
    data: Vec<ImageGenerationData>,
}

#[derive(Debug, Deserialize)]
struct ImageGenerationData {
    url: Option<String>,
}

impl<'a> OpenAiCompatibleImageProvider<'a> {
    pub fn new(provider: &'a ProviderConfig, generated_dir: &'a Path) -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .map_err(|error| error.to_string())?;

        Ok(Self {
            provider,
            generated_dir,
            client,
        })
    }

    fn create_image(
        &self,
        node_id: &str,
        request: ImageGenerationRequest,
    ) -> Result<ImageResult, String> {
        let endpoint = format!(
            "{}/images/generations",
            self.provider.base_url.trim().trim_end_matches('/')
        );

        let response = self
            .client
            .post(endpoint)
            .bearer_auth(self.provider.api_key.trim())
            .json(&request)
            .send()
            .map_err(|error| format!("图片 API 请求失败：{}", error))?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().unwrap_or_else(|_| String::new());
            return Err(format!("图片 API 返回错误 {}：{}", status, body));
        }

        let body: ImageGenerationResponse = response
            .json()
            .map_err(|error| format!("图片 API 响应解析失败：{}", error))?;
        let remote_url = body
            .data
            .first()
            .and_then(|item| item.url.clone())
            .ok_or_else(|| "图片 API 响应缺少 data[0].url".to_string())?;
        let local_path = self.download_image(node_id, &remote_url)?;

        Ok(ImageResult {
            remote_url,
            local_path,
        })
    }

    fn download_image(&self, node_id: &str, remote_url: &str) -> Result<String, String> {
        fs::create_dir_all(self.generated_dir).map_err(|error| error.to_string())?;

        let response = self
            .client
            .get(remote_url)
            .send()
            .map_err(|error| format!("下载生成图片失败：{}", error))?;
        let status = response.status();
        if !status.is_success() {
            return Err(format!("下载生成图片返回错误：{}", status));
        }

        let extension = image_extension(response.headers().get(reqwest::header::CONTENT_TYPE));
        let bytes = response
            .bytes()
            .map_err(|error| format!("读取生成图片内容失败：{}", error))?;
        let path = self
            .generated_dir
            .join(result_file_name(node_id, extension)?);
        fs::write(&path, bytes).map_err(|error| error.to_string())?;

        Ok(path.to_string_lossy().into_owned())
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
                response_format: Some("url".to_string()),
                tags: None,
                image: None,
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
                response_format: Some("url".to_string()),
                tags: Some(vec!["img2img".to_string()]),
                image: Some(vec![input.image_url]),
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
        .as_secs();
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
