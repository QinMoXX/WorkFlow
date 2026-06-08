use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use tauri::{AppHandle, Manager};

use super::models::{ImportedImage, WorkflowSnapshot};

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

pub fn save_imported_data_url(
    app: &AppHandle,
    data_url: &str,
    thumbnail_data_url: Option<&str>,
) -> Result<ImportedImage, String> {
    let (mime_type, encoded) = parse_image_data_url(data_url)?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| format!("解析导入图片失败：{}", error))?;
    let directory = imported_assets_dir(app)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let timestamp = timestamp_millis()?;
    let path = directory.join(format!(
        "imported-{}.{}",
        timestamp,
        extension_for_mime(mime_type)?
    ));
    fs::write(&path, bytes).map_err(|error| format!("保存导入图片失败：{}", error))?;

    let thumbnail_path = thumbnail_data_url
        .map(|thumbnail| save_thumbnail_data_url(app, thumbnail, timestamp))
        .transpose()?;

    Ok(ImportedImage {
        image_path: path.to_string_lossy().to_string(),
        thumbnail_path,
    })
}

pub fn save_image_as_path(image_path: &str, destination_path: &str) -> Result<String, String> {
    let source = Path::new(image_path);
    if !source.exists() {
        return Err(format!("图片不存在：{}", image_path));
    }

    let destination = Path::new(destination_path);
    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("创建保存目录失败：{}；原因：{}", parent.display(), error)
            })?;
        }
    }

    fs::copy(source, destination)
        .map_err(|error| format!("保存图片失败：{}；原因：{}", destination.display(), error))?;
    Ok(destination.to_string_lossy().to_string())
}

pub fn show_path_in_folder(image_path: &str) -> Result<(), String> {
    let path = Path::new(image_path);
    if !path.exists() {
        return Err(format!("图片不存在：{}", image_path));
    }
    let directory = path
        .parent()
        .ok_or_else(|| format!("无法定位图片所在目录：{}", image_path))?;

    #[cfg(target_os = "windows")]
    let status = Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .status();

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg("-R").arg(path).status();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open").arg(directory).status();

    let status = status.map_err(|error| format!("打开文件夹失败：{}", error))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("打开文件夹失败，退出码：{}", status))
    }
}

fn imported_assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("assets").join("imported"))
        .map_err(|error| error.to_string())
}

fn thumbnails_assets_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("assets").join("thumbnails"))
        .map_err(|error| error.to_string())
}

fn save_thumbnail_data_url(
    app: &AppHandle,
    thumbnail_data_url: &str,
    timestamp: u128,
) -> Result<String, String> {
    let (mime_type, encoded) = parse_image_data_url(thumbnail_data_url)?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| format!("解析缩略图失败：{}", error))?;
    let directory = thumbnails_assets_dir(app)?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join(format!(
        "thumb-{}.{}",
        timestamp,
        extension_for_mime(mime_type)?
    ));
    fs::write(&path, bytes).map_err(|error| format!("保存缩略图失败：{}", error))?;
    Ok(path.to_string_lossy().to_string())
}

fn parse_image_data_url(data_url: &str) -> Result<(&str, &str), String> {
    let (metadata, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| "图片 data URL 格式无效".to_string())?;
    let mime_type = metadata
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .ok_or_else(|| "图片不是 base64 data URL".to_string())?;

    if !mime_type.starts_with("image/") {
        return Err(format!("导入内容不是图片：{}", mime_type));
    }

    Ok((mime_type, encoded))
}

fn extension_for_mime(mime_type: &str) -> Result<&'static str, String> {
    match mime_type {
        "image/jpeg" | "image/jpg" => Ok("jpg"),
        "image/png" => Ok("png"),
        "image/webp" => Ok("webp"),
        "image/gif" => Ok("gif"),
        value => Err(format!("不支持的图片类型：{}", value)),
    }
}

fn timestamp_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

fn workflow_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("current.json"))
        .map_err(|error| error.to_string())
}
