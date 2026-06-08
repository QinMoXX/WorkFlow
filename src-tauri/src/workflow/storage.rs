use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use tauri::{AppHandle, Manager};

use super::models::WorkflowSnapshot;

pub fn save_workflow_snapshot(app: &AppHandle, snapshot: &WorkflowSnapshot) -> Result<(), String> {
    let path = workflow_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let json = serde_json::to_string_pretty(snapshot).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())
}

pub fn load_workflow_snapshot(app: &AppHandle) -> Result<Option<WorkflowSnapshot>, String> {
    let path = workflow_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&json)
        .map(Some)
        .map_err(|error| error.to_string())
}

pub fn generated_assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("assets").join("generated"))
        .map_err(|error| error.to_string())
}

pub fn save_imported_data_url(app: &AppHandle, data_url: &str) -> Result<String, String> {
    let (mime_type, encoded) = parse_image_data_url(data_url)?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| format!("解析剪切板图片失败：{}", error))?;
    let directory = imported_assets_dir(app)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let path = directory.join(format!(
        "pasted-{}.{}",
        timestamp,
        extension_for_mime(mime_type)?
    ));
    fs::write(&path, bytes).map_err(|error| format!("保存剪切板图片失败：{}", error))?;

    Ok(path.to_string_lossy().to_string())
}

fn imported_assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("assets").join("imported"))
        .map_err(|error| error.to_string())
}

fn parse_image_data_url(data_url: &str) -> Result<(&str, &str), String> {
    let (metadata, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "剪切板图片 data URL 格式无效".to_string())?;
    let mime_type = metadata
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .ok_or_else(|| "剪切板图片不是 base64 data URL".to_string())?;

    if !mime_type.starts_with("image/") {
        return Err(format!("剪切板内容不是图片：{}", mime_type));
    }

    Ok((mime_type, encoded))
}

fn extension_for_mime(mime_type: &str) -> Result<&'static str, String> {
    match mime_type {
        "image/jpeg" | "image/jpg" => Ok("jpg"),
        "image/png" => Ok("png"),
        "image/webp" => Ok("webp"),
        "image/gif" => Ok("gif"),
        value => Err(format!("不支持的剪切板图片类型：{}", value)),
    }
}

fn workflow_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("current.json"))
        .map_err(|error| error.to_string())
}
