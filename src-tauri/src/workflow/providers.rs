use std::fs;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::models::WorkflowNodeKind;

pub const NEW_API_BASE_URL: &str = "https://new-api-production-c695.up.railway.app/v1";
const NEW_API_PROVIDER_ID: &str = "new-api";
const NEW_API_PROVIDER_NAME: &str = "New API";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProviderCapability {
    #[serde(alias = "textToImage", alias = "imageToImage")]
    ImageGeneration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModel {
    pub id: String,
    pub name: String,
    pub capability: ProviderCapability,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub api_key: String,
    #[serde(default)]
    pub proxy_url: Option<String>,
    pub models: Vec<ProviderModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ApiConfig {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalogConfig {
    pub base_url: String,
    pub models: Vec<ProviderModel>,
    pub model_whitelist_by_node_kind: Vec<NodeModelWhitelist>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeModelWhitelist {
    pub node_kind: WorkflowNodeKind,
    pub model_ids: Vec<String>,
}

pub fn save_api_config(app: &AppHandle, config: &ApiConfig) -> Result<(), String> {
    if config.api_key.trim().is_empty() {
        return Err("API Key 不能为空".to_string());
    }

    let path = api_config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "创建 AI 配置目录失败：{}；原因：{}",
                parent.display(),
                error
            )
        })?;
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|error| format!("序列化 AI 配置失败：{}", error))?;
    fs::write(&path, json)
        .map_err(|error| format!("写入 AI 配置失败：{}；原因：{}", path.display(), error))
}

pub fn load_api_config(app: &AppHandle) -> Result<ApiConfig, String> {
    let path = api_config_path(app)?;
    if path.exists() {
        let json = fs::read_to_string(&path)
            .map_err(|error| format!("读取 AI 配置失败：{}；原因：{}", path.display(), error))?;
        return serde_json::from_str(&json).map_err(|error| {
            format!(
                "解析 AI 配置 JSON 失败：{}；原因：{}",
                path.display(),
                error
            )
        });
    }

    load_legacy_api_key(app).map(|api_key| ApiConfig { api_key })
}

pub fn load_runtime_provider(app: &AppHandle) -> Result<ProviderConfig, String> {
    let config = load_api_config(app)?;
    if config.api_key.trim().is_empty() {
        return Err("缺少 New API Key，请先在 AI 配置中填写 API Key".to_string());
    }

    Ok(ProviderConfig {
        id: NEW_API_PROVIDER_ID.to_string(),
        name: NEW_API_PROVIDER_NAME.to_string(),
        base_url: NEW_API_BASE_URL.to_string(),
        api_key: config.api_key,
        proxy_url: None,
        models: model_catalog(),
    })
}

pub fn load_model_catalog() -> ModelCatalogConfig {
    ModelCatalogConfig {
        base_url: NEW_API_BASE_URL.to_string(),
        models: model_catalog(),
        model_whitelist_by_node_kind: vec![
            NodeModelWhitelist {
                node_kind: WorkflowNodeKind::ImageGeneration,
                model_ids: model_whitelist_for_node(WorkflowNodeKind::ImageGeneration)
                    .iter()
                    .map(|model_id| (*model_id).to_string())
                    .collect(),
            },
            NodeModelWhitelist {
                node_kind: WorkflowNodeKind::TextToImage,
                model_ids: model_whitelist_for_node(WorkflowNodeKind::TextToImage)
                    .iter()
                    .map(|model_id| (*model_id).to_string())
                    .collect(),
            },
            NodeModelWhitelist {
                node_kind: WorkflowNodeKind::ImageToImage,
                model_ids: model_whitelist_for_node(WorkflowNodeKind::ImageToImage)
                    .iter()
                    .map(|model_id| (*model_id).to_string())
                    .collect(),
            },
        ],
    }
}

pub fn resolve_ai_node_provider<'a>(
    provider: &'a ProviderConfig,
    model_id: Option<&str>,
    capability: ProviderCapability,
    node_kind: WorkflowNodeKind,
) -> Result<&'a ProviderConfig, String> {
    let model_id = model_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "缺少模型预设".to_string())?;

    provider
        .models
        .iter()
        .find(|model| model.id == model_id && model.capability == capability)
        .ok_or_else(|| format!("模型预设不存在或能力不匹配：{}", model_id))?;

    if !model_whitelist_for_node(node_kind).contains(&model_id) {
        return Err(format!("模型 {} 不在当前节点白名单中", model_id));
    }

    Ok(provider)
}

fn model_catalog() -> Vec<ProviderModel> {
    vec![
        ProviderModel {
            id: "agnes-image-2.0-flash".to_string(),
            name: "Agnes Image 2.0 Flash".to_string(),
            capability: ProviderCapability::ImageGeneration,
        },
        ProviderModel {
            id: "gpt-image-1".to_string(),
            name: "GPT Image 1".to_string(),
            capability: ProviderCapability::ImageGeneration,
        },
        ProviderModel {
            id: "qwen-image-2.0-pro".to_string(),
            name: "Qwen Image 2.0 Pro".to_string(),
            capability: ProviderCapability::ImageGeneration,
        },
        ProviderModel {
            id: "qwen-image-2.0".to_string(),
            name: "Qwen Image 2.0".to_string(),
            capability: ProviderCapability::ImageGeneration,
        },
        ProviderModel {
            id: "qwen-image-max".to_string(),
            name: "Qwen Image Max".to_string(),
            capability: ProviderCapability::ImageGeneration,
        },
    ]
}

fn model_whitelist_for_node(kind: WorkflowNodeKind) -> &'static [&'static str] {
    match kind {
        WorkflowNodeKind::ImageGeneration | WorkflowNodeKind::TextToImage => &[
            "agnes-image-2.0-flash",
            "gpt-image-1",
            "qwen-image-2.0-pro",
            "qwen-image-2.0",
            "qwen-image-max",
        ],
        WorkflowNodeKind::ImageToImage => &["qwen-image-2.0-pro", "qwen-image-2.0"],
        _ => &[],
    }
}

fn load_legacy_api_key(app: &AppHandle) -> Result<String, String> {
    let path = legacy_provider_config_path(app)?;
    if !path.exists() {
        return Ok(String::new());
    }

    let json = fs::read_to_string(&path)
        .map_err(|error| format!("读取旧供应商配置失败：{}；原因：{}", path.display(), error))?;
    let providers: Vec<ProviderConfig> = serde_json::from_str(&json).map_err(|error| {
        format!(
            "解析旧供应商配置 JSON 失败：{}；原因：{}",
            path.display(),
            error
        )
    })?;

    Ok(providers
        .iter()
        .find(|provider| provider.base_url.trim_end_matches('/') == NEW_API_BASE_URL)
        .or_else(|| providers.first())
        .map(|provider| provider.api_key.clone())
        .unwrap_or_default())
}

fn api_config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("ai").join("config.json"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn legacy_provider_config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("providers").join("config.json"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}
