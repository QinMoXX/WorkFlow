use std::{collections::HashSet, fs};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ProviderCapability {
    TextToImage,
    ImageToImage,
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

pub fn save_provider_configs(app: &AppHandle, providers: &[ProviderConfig]) -> Result<(), String> {
    validate_provider_configs(providers)?;
    let path = provider_config_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let json = serde_json::to_string_pretty(providers).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())
}

pub fn load_provider_configs(app: &AppHandle) -> Result<Vec<ProviderConfig>, String> {
    let path = provider_config_path(app)?;
    if !path.exists() {
        return Ok(default_provider_configs());
    }

    let json = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&json).map_err(|error| error.to_string())
}

fn default_provider_configs() -> Vec<ProviderConfig> {
    vec![
        ProviderConfig {
            id: "openai".to_string(),
            name: "OpenAI".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: String::new(),
            proxy_url: None,
            models: vec![
                ProviderModel {
                    id: "gpt-image-1".to_string(),
                    name: "GPT Image 1".to_string(),
                    capability: ProviderCapability::TextToImage,
                },
                ProviderModel {
                    id: "gpt-image-1".to_string(),
                    name: "GPT Image 1 Edit".to_string(),
                    capability: ProviderCapability::ImageToImage,
                },
            ],
        },
        ProviderConfig {
            id: "agnes".to_string(),
            name: "Agnes AI".to_string(),
            base_url: "https://apihub.agnes-ai.com/v1".to_string(),
            api_key: String::new(),
            proxy_url: None,
            models: vec![
                ProviderModel {
                    id: "agnes-image-2.0-flash".to_string(),
                    name: "Agnes Image 2.0 Flash".to_string(),
                    capability: ProviderCapability::TextToImage,
                },
                ProviderModel {
                    id: "agnes-image-2.0-flash".to_string(),
                    name: "Agnes Image 2.0 Flash Edit".to_string(),
                    capability: ProviderCapability::ImageToImage,
                },
            ],
        },
    ]
}

pub fn resolve_ai_node_provider<'a>(
    providers: &'a [ProviderConfig],
    provider_id: Option<&str>,
    model_id: Option<&str>,
    capability: ProviderCapability,
) -> Result<&'a ProviderConfig, String> {
    let provider_id = provider_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "缺少供应商预设".to_string())?;
    let model_id = model_id
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "缺少模型预设".to_string())?;

    let provider = providers
        .iter()
        .find(|item| item.id == provider_id)
        .ok_or_else(|| format!("供应商预设不存在：{}", provider_id))?;

    if provider.base_url.trim().is_empty() {
        return Err(format!("供应商 {} 缺少 URL", provider.name));
    }
    if provider.api_key.trim().is_empty() {
        return Err(format!("供应商 {} 缺少 API Key", provider.name));
    }

    provider
        .models
        .iter()
        .find(|model| model.id == model_id && model.capability == capability)
        .ok_or_else(|| format!("模型预设不存在或能力不匹配：{}", model_id))?;

    Ok(provider)
}

fn validate_provider_configs(providers: &[ProviderConfig]) -> Result<(), String> {
    let mut provider_ids = HashSet::new();

    for provider in providers {
        if provider.id.trim().is_empty() {
            return Err("供应商 ID 不能为空".to_string());
        }
        if !provider_ids.insert(provider.id.trim().to_string()) {
            return Err(format!("供应商 ID 重复：{}", provider.id));
        }
        if provider.name.trim().is_empty() {
            return Err(format!("供应商 {} 名称不能为空", provider.id));
        }
        let mut model_keys = HashSet::new();
        for model in &provider.models {
            if model.id.trim().is_empty() {
                return Err(format!("供应商 {} 存在空模型 ID", provider.name));
            }
            let model_key = format!("{}::{:?}", model.id.trim(), model.capability);
            if !model_keys.insert(model_key) {
                return Err(format!(
                    "供应商 {} 存在重复模型 ID 和能力组合：{}",
                    provider.name, model.id
                ));
            }
        }
    }

    Ok(())
}

fn provider_config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("providers").join("config.json"))
        .map_err(|error| error.to_string())
}
