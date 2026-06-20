use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use tauri::{AppHandle, Manager};

use super::models::{ImportedImage, WorkflowCanvas, WorkflowProject, WorkflowSnapshot};

const DEFAULT_CANVAS_ID: &str = "canvas-1";
const DEFAULT_CANVAS_NAME: &str = "画布 1";

pub fn save_workflow_snapshot(app: &AppHandle, snapshot: &WorkflowSnapshot) -> Result<(), String> {
    let path = workflow_path(app)?;
    if let Some(parent) = path.parent() {
        create_dir_all_with_context(parent, "创建工作流保存目录")?;
    }

    let json = serde_json::to_string_pretty(snapshot)
        .map_err(|error| format!("序列化工作流失败：{}", error))?;
    fs::write(&path, json)
        .map_err(|error| format!("写入工作流文件失败：{}；原因：{}", path.display(), error))
}

pub fn load_workflow_snapshot(app: &AppHandle) -> Result<Option<WorkflowSnapshot>, String> {
    let path = workflow_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(&path)
        .map_err(|error| format!("读取工作流文件失败：{}；原因：{}", path.display(), error))?;
    serde_json::from_str(&json)
        .map(Some)
        .map_err(|error| format!("解析工作流 JSON 失败：{}；原因：{}", path.display(), error))
}

pub fn save_workflow_project(app: &AppHandle, project: &WorkflowProject) -> Result<(), String> {
    let project = normalized_project(project.clone());
    if project.canvases.is_empty() {
        return Err("项目至少需要一个画布".to_string());
    }
    if !project
        .canvases
        .iter()
        .any(|canvas| canvas.id == project.active_canvas_id)
    {
        return Err("当前画布不存在".to_string());
    }

    create_project_canvas_dirs(app, &project)?;

    let path = workflow_project_path(app)?;
    if let Some(parent) = path.parent() {
        create_dir_all_with_context(parent, "创建工作流保存目录")?;
    }

    let json = serde_json::to_string_pretty(&project)
        .map_err(|error| format!("序列化项目失败：{}", error))?;
    fs::write(&path, json)
        .map_err(|error| format!("写入项目文件失败：{}；原因：{}", path.display(), error))
}

pub fn load_workflow_project(app: &AppHandle) -> Result<WorkflowProject, String> {
    let path = workflow_project_path(app)?;
    if path.exists() {
        let json = fs::read_to_string(&path)
            .map_err(|error| format!("读取项目文件失败：{}；原因：{}", path.display(), error))?;
        let project: WorkflowProject = serde_json::from_str(&json)
            .map_err(|error| format!("解析项目 JSON 失败：{}；原因：{}", path.display(), error))?;
        return Ok(normalized_project(project));
    }

    if let Some(snapshot) = load_workflow_snapshot(app)? {
        let project = project_from_snapshot(snapshot);
        create_project_canvas_dirs(app, &project)?;
        return Ok(project);
    }

    let project = default_project();
    create_project_canvas_dirs(app, &project)?;
    Ok(project)
}

pub fn generated_assets_dir(app: &AppHandle, canvas_id: &str) -> Result<PathBuf, String> {
    canvas_asset_subdir(app, canvas_id, "generated")
}

pub fn output_assets_dir(app: &AppHandle, canvas_id: &str) -> Result<PathBuf, String> {
    canvas_asset_subdir(app, canvas_id, "output")
}

pub fn rename_canvas_assets_dir(
    app: &AppHandle,
    project: &WorkflowProject,
    canvas_id: &str,
    next_name: &str,
) -> Result<String, String> {
    let project = normalized_project(project.clone());
    let canvas = project
        .canvases
        .iter()
        .find(|item| item.id == canvas_id)
        .ok_or_else(|| format!("画布不存在：{}", canvas_id))?;
    let root = configured_asset_root_dir(app, &project)?;
    create_dir_all_with_context(&root, "创建画布资源根目录")?;

    let next_asset_dir_name = unique_canvas_asset_dir_name(
        &root,
        &project,
        canvas_id,
        &sanitize_asset_dir_name(next_name),
    );
    let old_dir = root.join(&canvas.asset_dir_name);
    let next_dir = root.join(&next_asset_dir_name);

    if old_dir != next_dir {
        if old_dir.exists() {
            fs::rename(&old_dir, &next_dir).map_err(|error| {
                format!(
                    "重命名画布资源目录失败：{} -> {}；原因：{}",
                    old_dir.display(),
                    next_dir.display(),
                    error
                )
            })?;
        } else {
            create_dir_all_with_context(&next_dir, "创建画布资源目录")?;
        }
    }

    for subdir in ["imported", "generated", "thumbnails", "output"] {
        create_dir_all_with_context(&next_dir.join(subdir), "创建画布资源子目录")?;
    }
    Ok(next_asset_dir_name)
}

pub fn delete_canvas_assets_dir(
    app: &AppHandle,
    project: &WorkflowProject,
    canvas_id: &str,
) -> Result<(), String> {
    let project = normalized_project(project.clone());
    let directory = canvas_asset_dir(app, &project, canvas_id)?;
    if !directory.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&directory).map_err(|error| {
        format!(
            "删除画布资源目录失败：{}；原因：{}",
            directory.display(),
            error
        )
    })
}

pub fn open_canvas_assets_dir(
    app: &AppHandle,
    project: &WorkflowProject,
    canvas_id: &str,
) -> Result<(), String> {
    let project = normalized_project(project.clone());
    let directory = canvas_asset_dir(app, &project, canvas_id)?;
    create_dir_all_with_context(&directory, "创建画布资源目录")?;
    open_directory(&directory)
}

pub fn save_imported_data_url(
    app: &AppHandle,
    canvas_id: &str,
    data_url: &str,
    thumbnail_data_url: Option<&str>,
) -> Result<ImportedImage, String> {
    let (mime_type, encoded) = parse_image_data_url(data_url)?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| format!("解析导入图片失败：{}", error))?;
    let directory = imported_assets_dir(app, canvas_id)?;
    create_dir_all_with_context(&directory, "创建导入图片目录")?;
    let timestamp = timestamp_millis()?;
    let path = directory.join(format!(
        "imported-{}.{}",
        timestamp,
        extension_for_mime(mime_type)?
    ));
    fs::write(&path, bytes)
        .map_err(|error| format!("保存导入图片失败：{}；原因：{}", path.display(), error))?;

    let thumbnail_path = thumbnail_data_url
        .map(|thumbnail| save_thumbnail_data_url(app, canvas_id, thumbnail, timestamp))
        .transpose()?;

    Ok(ImportedImage {
        image_path: path.to_string_lossy().to_string(),
        thumbnail_path,
    })
}

pub fn save_image_as_path(image_path: &str, destination_path: &str) -> Result<String, String> {
    if destination_path.trim().is_empty() {
        return Err("保存路径为空".to_string());
    }

    let source = Path::new(image_path);
    if !source.exists() {
        return Err(format!("图片不存在：{}", image_path));
    }
    if !source.is_file() {
        return Err(format!("图片路径不是文件：{}", source.display()));
    }

    let destination = Path::new(destination_path);
    if let Some(parent) = destination.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("创建保存目录失败：{}；原因：{}", parent.display(), error)
            })?;
        }
    }

    fs::copy(source, destination).map_err(|error| {
        format!(
            "保存图片失败：源 {}；目标 {}；原因：{}",
            source.display(),
            destination.display(),
            error
        )
    })?;
    Ok(destination.to_string_lossy().to_string())
}

pub fn show_path_in_folder(image_path: &str) -> Result<(), String> {
    let path = Path::new(image_path);
    if !path.exists() {
        return Err(format!("图片不存在：{}", image_path));
    }
    #[cfg(target_os = "windows")]
    let status = Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .status();

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg("-R").arg(path).status();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = {
        let directory = path
            .parent()
            .ok_or_else(|| format!("无法定位图片所在目录：{}", image_path))?;
        Command::new("xdg-open").arg(directory).status()
    };

    let status = status.map_err(|error| format!("打开文件夹失败：{}", error))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("打开文件夹失败，退出码：{}", status))
    }
}

fn open_directory(directory: &Path) -> Result<(), String> {
    if !directory.exists() {
        return Err(format!("目录不存在：{}", directory.display()));
    }

    #[cfg(target_os = "windows")]
    let status = Command::new("explorer").arg(directory).status();

    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(directory).status();

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open").arg(directory).status();

    let status = status.map_err(|error| format!("打开目录失败：{}", error))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("打开目录失败，退出码：{}", status))
    }
}

fn imported_assets_dir(app: &AppHandle, canvas_id: &str) -> Result<PathBuf, String> {
    canvas_asset_subdir(app, canvas_id, "imported")
}

fn thumbnails_assets_dir(app: &AppHandle, canvas_id: &str) -> Result<PathBuf, String> {
    canvas_asset_subdir(app, canvas_id, "thumbnails")
}

fn save_thumbnail_data_url(
    app: &AppHandle,
    canvas_id: &str,
    thumbnail_data_url: &str,
    timestamp: u128,
) -> Result<String, String> {
    let (mime_type, encoded) = parse_image_data_url(thumbnail_data_url)?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| format!("解析缩略图失败：{}", error))?;
    let directory = thumbnails_assets_dir(app, canvas_id)?;
    create_dir_all_with_context(&directory, "创建缩略图目录")?;
    let path = directory.join(format!(
        "thumb-{}.{}",
        timestamp,
        extension_for_mime(mime_type)?
    ));
    fs::write(&path, bytes)
        .map_err(|error| format!("保存缩略图失败：{}；原因：{}", path.display(), error))?;
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
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn workflow_project_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("project.json"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn default_asset_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("assets").join("canvases"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn configured_asset_root_dir(
    app: &AppHandle,
    project: &WorkflowProject,
) -> Result<PathBuf, String> {
    match project
        .asset_root_dir
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(path) => Ok(PathBuf::from(path)),
        None => default_asset_root_dir(app),
    }
}

fn canvas_asset_dir(
    app: &AppHandle,
    project: &WorkflowProject,
    canvas_id: &str,
) -> Result<PathBuf, String> {
    let canvas = project
        .canvases
        .iter()
        .find(|item| item.id == canvas_id)
        .ok_or_else(|| format!("画布不存在：{}", canvas_id))?;
    Ok(configured_asset_root_dir(app, project)?.join(&canvas.asset_dir_name))
}

fn canvas_asset_subdir(app: &AppHandle, canvas_id: &str, subdir: &str) -> Result<PathBuf, String> {
    let project = load_workflow_project(app)?;
    Ok(canvas_asset_dir(app, &project, canvas_id)?.join(subdir))
}

fn create_project_canvas_dirs(app: &AppHandle, project: &WorkflowProject) -> Result<(), String> {
    let root = configured_asset_root_dir(app, project)?;
    create_dir_all_with_context(&root, "创建画布资源根目录")?;
    for canvas in &project.canvases {
        let canvas_dir = root.join(&canvas.asset_dir_name);
        create_dir_all_with_context(&canvas_dir, "创建画布资源目录")?;
        for subdir in ["imported", "generated", "thumbnails", "output"] {
            create_dir_all_with_context(&canvas_dir.join(subdir), "创建画布资源子目录")?;
        }
    }
    Ok(())
}

fn default_project() -> WorkflowProject {
    project_from_snapshot(WorkflowSnapshot {
        nodes: Vec::new(),
        edges: Vec::new(),
    })
}

fn project_from_snapshot(snapshot: WorkflowSnapshot) -> WorkflowProject {
    WorkflowProject {
        active_canvas_id: DEFAULT_CANVAS_ID.to_string(),
        asset_root_dir: None,
        canvases: vec![WorkflowCanvas {
            id: DEFAULT_CANVAS_ID.to_string(),
            name: DEFAULT_CANVAS_NAME.to_string(),
            asset_dir_name: DEFAULT_CANVAS_ID.to_string(),
            snapshot,
        }],
    }
}

fn normalized_project(mut project: WorkflowProject) -> WorkflowProject {
    if project.canvases.is_empty() {
        return default_project();
    }

    for (index, canvas) in project.canvases.iter_mut().enumerate() {
        if canvas.id.trim().is_empty() {
            canvas.id = format!("canvas-{}", index + 1);
        }
        if canvas.name.trim().is_empty() {
            canvas.name = format!("画布 {}", index + 1);
        }
        if canvas.asset_dir_name.trim().is_empty() {
            canvas.asset_dir_name = sanitize_asset_dir_name(&canvas.id);
        } else {
            canvas.asset_dir_name = sanitize_asset_dir_name(&canvas.asset_dir_name);
        }
    }

    if !project
        .canvases
        .iter()
        .any(|canvas| canvas.id == project.active_canvas_id)
    {
        project.active_canvas_id = project.canvases[0].id.clone();
    }
    project.asset_root_dir = project
        .asset_root_dir
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty());
    project
}

fn sanitize_asset_dir_name(value: &str) -> String {
    let cleaned: String = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches('-');
    if cleaned.is_empty() {
        "canvas".to_string()
    } else {
        cleaned.to_string()
    }
}

fn unique_canvas_asset_dir_name(
    root: &Path,
    project: &WorkflowProject,
    canvas_id: &str,
    base_name: &str,
) -> String {
    let base_name = if base_name.trim().is_empty() {
        "canvas"
    } else {
        base_name
    };
    let occupied_names: Vec<&str> = project
        .canvases
        .iter()
        .filter(|canvas| canvas.id != canvas_id)
        .map(|canvas| canvas.asset_dir_name.as_str())
        .collect();
    let current_name = project
        .canvases
        .iter()
        .find(|canvas| canvas.id == canvas_id)
        .map(|canvas| canvas.asset_dir_name.as_str());

    for index in 0..1000 {
        let candidate = if index == 0 {
            base_name.to_string()
        } else {
            format!("{}-{}", base_name, index + 1)
        };
        if occupied_names.contains(&candidate.as_str()) {
            continue;
        }
        if Some(candidate.as_str()) == current_name {
            return candidate;
        }
        if !root.join(&candidate).exists() {
            return candidate;
        }
    }

    format!("{}-{}", base_name, timestamp_millis().unwrap_or_default())
}

fn create_dir_all_with_context(path: &Path, action: &str) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("{}失败：{}；原因：{}", action, path.display(), error))
}
