use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use tauri::{AppHandle, Manager};

use super::models::{
    ImportedImage, ProjectAsset, WorkflowCanvas, WorkflowProject, WorkflowProjectIndex,
    WorkflowProjectSummary, WorkflowSnapshot,
};

const DEFAULT_CANVAS_ID: &str = "canvas-1";
const DEFAULT_CANVAS_NAME: &str = "画布 1";
const DEFAULT_PROJECT_ID: &str = "project-default";
const DEFAULT_PROJECT_NAME: &str = "默认项目";

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

    create_project_dirs(app, &project)?;

    let path = workflow_project_path(app, &project.id)?;
    if let Some(parent) = path.parent() {
        create_dir_all_with_context(parent, "创建工作流保存目录")?;
    }

    let json = serde_json::to_string_pretty(&project)
        .map_err(|error| format!("序列化项目失败：{}", error))?;
    fs::write(&path, json)
        .map_err(|error| format!("写入项目文件失败：{}；原因：{}", path.display(), error))
}

pub fn load_workflow_project(app: &AppHandle) -> Result<WorkflowProject, String> {
    let mut index = load_workflow_project_index(app)?;
    let active_project_id = index.active_project_id.clone();
    let path = workflow_project_path(app, &active_project_id)?;
    if path.exists() {
        let json = fs::read_to_string(&path)
            .map_err(|error| format!("读取项目文件失败：{}；原因：{}", path.display(), error))?;
        let project: WorkflowProject = serde_json::from_str(&json)
            .map_err(|error| format!("解析项目 JSON 失败：{}；原因：{}", path.display(), error))?;
        let (project, changed) = normalized_project_with_existing_images(app, project);
        if changed {
            save_workflow_project(app, &project)?;
        }
        touch_project(app, &mut index, &active_project_id)?;
        return Ok(project);
    }

    let legacy_project_path = legacy_workflow_project_path(app)?;
    if legacy_project_path.exists() {
        let json = fs::read_to_string(&legacy_project_path).map_err(|error| {
            format!(
                "读取旧项目文件失败：{}；原因：{}",
                legacy_project_path.display(),
                error
            )
        })?;
        let mut project: WorkflowProject = serde_json::from_str(&json).map_err(|error| {
            format!(
                "解析旧项目 JSON 失败：{}；原因：{}",
                legacy_project_path.display(),
                error
            )
        })?;
        project.id = active_project_id;
        project.name = DEFAULT_PROJECT_NAME.to_string();
        project.asset_dir_name = sanitize_asset_dir_name(DEFAULT_PROJECT_ID);
        let (project, _) = normalized_project_with_existing_images(app, project);
        save_workflow_project(app, &project)?;
        return Ok(project);
    }

    if let Some(snapshot) = load_workflow_snapshot(app)? {
        let (project, _) = normalized_project_with_existing_images(
            app,
            project_from_snapshot(snapshot, DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME),
        );
        save_workflow_project(app, &project)?;
        return Ok(project);
    }

    let (project, _) = normalized_project_with_existing_images(app, default_project());
    save_workflow_project(app, &project)?;
    Ok(project)
}

pub fn load_workflow_project_index(app: &AppHandle) -> Result<WorkflowProjectIndex, String> {
    let path = workflow_project_index_path(app)?;
    if path.exists() {
        let json = fs::read_to_string(&path)
            .map_err(|error| format!("读取项目索引失败：{}；原因：{}", path.display(), error))?;
        let index: WorkflowProjectIndex = serde_json::from_str(&json)
            .map_err(|error| format!("解析项目索引 JSON 失败：{}；原因：{}", path.display(), error))?;
        return Ok(normalized_project_index(index));
    }

    let index = default_project_index();
    save_workflow_project_index(app, &index)?;
    Ok(index)
}

pub fn create_workflow_project(app: &AppHandle, name: &str) -> Result<WorkflowProject, String> {
    let mut index = load_workflow_project_index(app)?;
    let created_at = timestamp_string()?;
    let id = format!("project-{}", timestamp_millis()?);
    let name = name.trim();
    let name = if name.is_empty() { "未命名项目" } else { name };
    let asset_dir_name = unique_project_asset_dir_name(app, &index, &sanitize_asset_dir_name(name))?;
    let project = WorkflowProject {
        id: id.clone(),
        name: name.to_string(),
        asset_dir_name: asset_dir_name.clone(),
        active_canvas_id: DEFAULT_CANVAS_ID.to_string(),
        asset_root_dir: None,
        canvases: vec![WorkflowCanvas {
            id: DEFAULT_CANVAS_ID.to_string(),
            name: DEFAULT_CANVAS_NAME.to_string(),
            asset_dir_name: DEFAULT_CANVAS_ID.to_string(),
            snapshot: WorkflowSnapshot {
                nodes: Vec::new(),
                edges: Vec::new(),
            },
        }],
    };
    index.active_project_id = id.clone();
    index.projects.push(WorkflowProjectSummary {
        id,
        name: name.to_string(),
        asset_dir_name,
        created_at: created_at.clone(),
        updated_at: created_at.clone(),
        last_opened_at: created_at,
    });
    save_workflow_project_index(app, &index)?;
    save_workflow_project(app, &project)?;
    Ok(project)
}

pub fn switch_workflow_project(app: &AppHandle, project_id: &str) -> Result<WorkflowProject, String> {
    let mut index = load_workflow_project_index(app)?;
    if !index.projects.iter().any(|project| project.id == project_id) {
        return Err(format!("项目不存在：{}", project_id));
    }
    index.active_project_id = project_id.to_string();
    touch_project(app, &mut index, project_id)?;
    load_workflow_project(app)
}

pub fn generated_assets_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    project_asset_subdir(app, project_id, "generated")
}

pub fn output_assets_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    project_asset_subdir(app, project_id, "output")
}

pub fn rename_canvas_assets_dir(
    app: &AppHandle,
    project: &WorkflowProject,
    canvas_id: &str,
    next_name: &str,
) -> Result<String, String> {
    let project = normalized_project(project.clone());
    let _ = app;
    let canvas = project
        .canvases
        .iter()
        .find(|item| item.id == canvas_id)
        .ok_or_else(|| format!("画布不存在：{}", canvas_id))?;
    let next_asset_dir_name = sanitize_asset_dir_name(next_name);
    Ok(if next_asset_dir_name.is_empty() {
        canvas.asset_dir_name.clone()
    } else {
        next_asset_dir_name
    })
}

pub fn delete_canvas_assets_dir(
    app: &AppHandle,
    project: &WorkflowProject,
    canvas_id: &str,
) -> Result<(), String> {
    let project = normalized_project(project.clone());
    let _ = app;
    if !project.canvases.iter().any(|item| item.id == canvas_id) {
        return Err(format!("画布不存在：{}", canvas_id));
    }
    Ok(())
}

pub fn open_canvas_assets_dir(
    app: &AppHandle,
    project: &WorkflowProject,
    _canvas_id: &str,
) -> Result<(), String> {
    let project = normalized_project(project.clone());
    let directory = project_assets_dir(app, &project)?;
    create_dir_all_with_context(&directory, "创建画布资源目录")?;
    open_directory(&directory)
}

pub fn save_imported_data_url(
    app: &AppHandle,
    project_id: &str,
    data_url: &str,
    thumbnail_data_url: Option<&str>,
) -> Result<ImportedImage, String> {
    let (mime_type, encoded) = parse_image_data_url(data_url)?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| format!("解析导入图片失败：{}", error))?;
    let directory = imported_assets_dir(app, project_id)?;
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
        .map(|thumbnail| save_thumbnail_data_url(app, project_id, thumbnail, timestamp))
        .transpose()?;

    Ok(ImportedImage {
        image_path: path.to_string_lossy().to_string(),
        thumbnail_path,
    })
}

pub fn list_project_assets(app: &AppHandle, project_id: &str) -> Result<Vec<ProjectAsset>, String> {
    let project = load_project_by_id(app, project_id)?;
    let assets_dir = project_assets_dir(app, &project)?;
    create_project_dirs(app, &project)?;

    let mut assets = Vec::new();
    for (kind, subdir) in [
        ("imported", "imported"),
        ("generated", "generated"),
        ("output", "output"),
    ] {
        let directory = assets_dir.join(subdir);
        if !directory.exists() {
            continue;
        }
        for entry in fs::read_dir(&directory)
            .map_err(|error| format!("读取资产目录失败：{}；原因：{}", directory.display(), error))?
        {
            let entry = entry.map_err(|error| format!("读取资产条目失败：{}", error))?;
            let path = entry.path();
            if !path.is_file() || !is_supported_image_path(&path) {
                continue;
            }
            let metadata = fs::metadata(&path)
                .map_err(|error| format!("读取资产信息失败：{}；原因：{}", path.display(), error))?;
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("asset")
                .to_string();
            assets.push(ProjectAsset {
                id: format!("{}:{}", kind, path.to_string_lossy()),
                kind: kind.to_string(),
                name,
                thumbnail_path: thumbnail_for_asset(&assets_dir, &path, kind),
                path: path.to_string_lossy().to_string(),
                size_bytes: metadata.len(),
                modified_at: metadata
                    .modified()
                    .ok()
                    .and_then(system_time_to_millis)
                    .unwrap_or_else(|| "0".to_string()),
            });
        }
    }

    assets.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(assets)
}

pub fn delete_project_asset(app: &AppHandle, project_id: &str, asset_path: &str) -> Result<(), String> {
    let project = load_project_by_id(app, project_id)?;
    let assets_dir = project_assets_dir(app, &project)?;
    let path = PathBuf::from(asset_path);
    ensure_child_path(&assets_dir, &path)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("删除资产失败：{}；原因：{}", path.display(), error))?;
    }
    Ok(())
}

pub fn open_project_asset(app: &AppHandle, project_id: &str, asset_path: &str) -> Result<(), String> {
    let project = load_project_by_id(app, project_id)?;
    let assets_dir = project_assets_dir(app, &project)?;
    let path = PathBuf::from(asset_path);
    ensure_child_path(&assets_dir, &path)?;
    show_path_in_folder(asset_path)
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
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(format!("/select,{}", path.display()));
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg("-R").arg(path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let directory = path
            .parent()
            .ok_or_else(|| format!("无法定位图片所在目录：{}", image_path))?;
        let mut command = Command::new("xdg-open");
        command.arg(directory);
        command
    };

    spawn_open_command(&mut command, "打开文件夹失败")
}

fn open_directory(directory: &Path) -> Result<(), String> {
    if !directory.exists() {
        return Err(format!("目录不存在：{}", directory.display()));
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(directory);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(directory);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(directory);
        command
    };

    spawn_open_command(&mut command, "打开目录失败")
}

fn spawn_open_command(command: &mut Command, error_context: &str) -> Result<(), String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    let mut child = command
        .spawn()
        .map_err(|error| format!("{}：{}", error_context, error))?;
    thread::spawn(move || {
        let _ = child.wait();
    });
    Ok(())
}

fn imported_assets_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    project_asset_subdir(app, project_id, "imported")
}

fn thumbnails_assets_dir(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    project_asset_subdir(app, project_id, "thumbnails")
}

fn save_thumbnail_data_url(
    app: &AppHandle,
    project_id: &str,
    thumbnail_data_url: &str,
    timestamp: u128,
) -> Result<String, String> {
    let (mime_type, encoded) = parse_image_data_url(thumbnail_data_url)?;
    let bytes = BASE64_STANDARD
        .decode(encoded)
        .map_err(|error| format!("解析缩略图失败：{}", error))?;
    let directory = thumbnails_assets_dir(app, project_id)?;
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

fn timestamp_string() -> Result<String, String> {
    timestamp_millis().map(|value| value.to_string())
}

fn system_time_to_millis(value: SystemTime) -> Option<String> {
    value
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis().to_string())
}

fn workflow_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("current.json"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn workflow_project_index_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("projects.json"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn legacy_workflow_project_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("project.json"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn workflow_project_path(app: &AppHandle, project_id: &str) -> Result<PathBuf, String> {
    let project = load_project_summary(app, project_id)?;
    app.path()
        .app_data_dir()
        .map(|path| {
            path.join("workflows")
                .join("projects")
                .join(project.asset_dir_name)
                .join("project.json")
        })
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn projects_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("projects"))
        .map_err(|error| format!("获取应用数据目录失败：{}", error))
}

fn project_root_dir(app: &AppHandle, project: &WorkflowProject) -> Result<PathBuf, String> {
    Ok(projects_root_dir(app)?.join(&project.asset_dir_name))
}

fn project_assets_dir(app: &AppHandle, project: &WorkflowProject) -> Result<PathBuf, String> {
    Ok(project_root_dir(app, project)?.join("assets"))
}

fn project_asset_subdir(app: &AppHandle, project_id: &str, subdir: &str) -> Result<PathBuf, String> {
    let project = load_project_by_id(app, project_id)?;
    Ok(project_assets_dir(app, &project)?.join(subdir))
}

fn create_project_dirs(app: &AppHandle, project: &WorkflowProject) -> Result<(), String> {
    let root = project_root_dir(app, project)?;
    create_dir_all_with_context(&root, "创建项目目录")?;
    let assets_dir = project_assets_dir(app, project)?;
    create_dir_all_with_context(&assets_dir, "创建项目资源目录")?;
    for subdir in ["imported", "generated", "thumbnails", "output"] {
        create_dir_all_with_context(&assets_dir.join(subdir), "创建项目资源子目录")?;
    }
    Ok(())
}

fn default_project() -> WorkflowProject {
    project_from_snapshot(
        WorkflowSnapshot {
            nodes: Vec::new(),
            edges: Vec::new(),
        },
        DEFAULT_PROJECT_ID,
        DEFAULT_PROJECT_NAME,
    )
}

fn project_from_snapshot(snapshot: WorkflowSnapshot, id: &str, name: &str) -> WorkflowProject {
    WorkflowProject {
        id: id.to_string(),
        name: name.to_string(),
        asset_dir_name: sanitize_asset_dir_name(id),
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
    if project.id.trim().is_empty() {
        project.id = DEFAULT_PROJECT_ID.to_string();
    }
    if project.name.trim().is_empty() {
        project.name = DEFAULT_PROJECT_NAME.to_string();
    }
    if project.asset_dir_name.trim().is_empty() {
        project.asset_dir_name = sanitize_asset_dir_name(&project.id);
    } else {
        project.asset_dir_name = sanitize_asset_dir_name(&project.asset_dir_name);
    }
    if project.canvases.is_empty() {
        project.canvases = default_project().canvases;
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

fn normalized_project_with_existing_images(
    app: &AppHandle,
    project: WorkflowProject,
) -> (WorkflowProject, bool) {
    let mut project = normalized_project(project);
    let changed = remove_missing_local_image_refs(app, &mut project);
    (project, changed)
}

fn remove_missing_local_image_refs(app: &AppHandle, project: &mut WorkflowProject) -> bool {
    let mut changed = false;
    let assets_dir = project_assets_dir(app, project).ok();

    for canvas in &mut project.canvases {
        for node in &mut canvas.snapshot.nodes {
            let mut node_changed = false;

            if clear_missing_local_image_ref(&mut node.data.image_path, assets_dir.as_deref()) {
                node_changed = true;
            }
            if clear_missing_local_image_ref(&mut node.data.thumbnail_path, assets_dir.as_deref()) {
                node_changed = true;
            }
            if clear_missing_local_image_ref(&mut node.data.result_path, assets_dir.as_deref()) {
                node_changed = true;
            }
            if clear_missing_local_image_ref(&mut node.data.last_output_path, assets_dir.as_deref()) {
                node_changed = true;
            }

            if node_changed {
                node.data.status = "idle".to_string();
                node.data.progress = None;
                node.data.error = None;
                changed = true;
            }
        }
    }

    changed
}

fn clear_missing_local_image_ref(value: &mut Option<String>, assets_dir: Option<&Path>) -> bool {
    let Some(current) = value.as_deref() else {
        return false;
    };
    if local_image_ref_is_available(current, assets_dir) {
        return false;
    }
    *value = None;
    true
}

fn local_image_ref_is_available(value: &str, assets_dir: Option<&Path>) -> bool {
    let value = value.trim();
    if value.is_empty() || is_direct_image_source(value) {
        return true;
    }

    let Some(path) = path_from_local_image_ref(value) else {
        return true;
    };
    if path.is_file() {
        return true;
    }

    assets_dir
        .and_then(|root| path.file_name().map(|name| root.join("thumbnails").join(name)))
        .is_some_and(|candidate| candidate.is_file())
}

fn is_direct_image_source(value: &str) -> bool {
    let value = value.to_ascii_lowercase();
    value.starts_with("http://")
        || value.starts_with("https://")
        || value.starts_with("data:image/")
        || value.starts_with("blob:")
        || value.starts_with("asset:")
        || value.starts_with("tauri:")
}

fn path_from_local_image_ref(value: &str) -> Option<PathBuf> {
    if let Some(rest) = value.strip_prefix("file:///") {
        #[cfg(target_os = "windows")]
        {
            return Some(PathBuf::from(rest.replace('/', "\\")));
        }
        #[cfg(not(target_os = "windows"))]
        {
            return Some(PathBuf::from(format!("/{}", rest)));
        }
    }
    if let Some(rest) = value.strip_prefix("file://") {
        return Some(PathBuf::from(rest));
    }
    Some(PathBuf::from(value))
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
        "project".to_string()
    } else {
        cleaned.to_string()
    }
}

fn default_project_index() -> WorkflowProjectIndex {
    let timestamp = timestamp_string().unwrap_or_else(|_| "0".to_string());
    WorkflowProjectIndex {
        active_project_id: DEFAULT_PROJECT_ID.to_string(),
        projects: vec![WorkflowProjectSummary {
            id: DEFAULT_PROJECT_ID.to_string(),
            name: DEFAULT_PROJECT_NAME.to_string(),
            asset_dir_name: sanitize_asset_dir_name(DEFAULT_PROJECT_ID),
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
            last_opened_at: timestamp,
        }],
    }
}

fn normalized_project_index(mut index: WorkflowProjectIndex) -> WorkflowProjectIndex {
    if index.projects.is_empty() {
        return default_project_index();
    }
    for project in &mut index.projects {
        if project.id.trim().is_empty() {
            project.id = format!("project-{}", timestamp_millis().unwrap_or_default());
        }
        if project.name.trim().is_empty() {
            project.name = "未命名项目".to_string();
        }
        if project.asset_dir_name.trim().is_empty() {
            project.asset_dir_name = sanitize_asset_dir_name(&project.id);
        } else {
            project.asset_dir_name = sanitize_asset_dir_name(&project.asset_dir_name);
        }
    }
    if !index
        .projects
        .iter()
        .any(|project| project.id == index.active_project_id)
    {
        index.active_project_id = index.projects[0].id.clone();
    }
    index
}

fn save_workflow_project_index(app: &AppHandle, index: &WorkflowProjectIndex) -> Result<(), String> {
    let path = workflow_project_index_path(app)?;
    if let Some(parent) = path.parent() {
        create_dir_all_with_context(parent, "创建项目索引目录")?;
    }
    let json = serde_json::to_string_pretty(&normalized_project_index(index.clone()))
        .map_err(|error| format!("序列化项目索引失败：{}", error))?;
    fs::write(&path, json)
        .map_err(|error| format!("写入项目索引失败：{}；原因：{}", path.display(), error))
}

fn load_project_summary(app: &AppHandle, project_id: &str) -> Result<WorkflowProjectSummary, String> {
    let index = load_workflow_project_index(app)?;
    index
        .projects
        .into_iter()
        .find(|project| project.id == project_id)
        .ok_or_else(|| format!("项目不存在：{}", project_id))
}

fn load_project_by_id(app: &AppHandle, project_id: &str) -> Result<WorkflowProject, String> {
    let summary = load_project_summary(app, project_id)?;
    let path = projects_root_dir(app)?
        .join(summary.asset_dir_name)
        .join("project.json");
    if !path.exists() {
        return Err(format!("项目文件不存在：{}", path.display()));
    }
    let json = fs::read_to_string(&path)
        .map_err(|error| format!("读取项目文件失败：{}；原因：{}", path.display(), error))?;
    let project: WorkflowProject = serde_json::from_str(&json)
        .map_err(|error| format!("解析项目 JSON 失败：{}；原因：{}", path.display(), error))?;
    Ok(normalized_project(project))
}

fn touch_project(
    app: &AppHandle,
    index: &mut WorkflowProjectIndex,
    project_id: &str,
) -> Result<(), String> {
    let now = timestamp_string()?;
    if let Some(project) = index.projects.iter_mut().find(|project| project.id == project_id) {
        project.last_opened_at = now.clone();
        project.updated_at = now;
    }
    save_workflow_project_index(app, index)
}

fn unique_project_asset_dir_name(
    app: &AppHandle,
    index: &WorkflowProjectIndex,
    base_name: &str,
) -> Result<String, String> {
    let root = projects_root_dir(app)?;
    let occupied: Vec<&str> = index
        .projects
        .iter()
        .map(|project| project.asset_dir_name.as_str())
        .collect();
    let base_name = if base_name.trim().is_empty() {
        "project"
    } else {
        base_name
    };
    for index in 0..1000 {
        let candidate = if index == 0 {
            base_name.to_string()
        } else {
            format!("{}-{}", base_name, index + 1)
        };
        if occupied.contains(&candidate.as_str()) || root.join(&candidate).exists() {
            continue;
        }
        return Ok(candidate);
    }
    Ok(format!("{}-{}", base_name, timestamp_millis()?))
}

fn is_supported_image_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "gif"
    )
}

fn thumbnail_for_asset(assets_dir: &Path, path: &Path, kind: &str) -> Option<String> {
    if kind != "imported" {
        return Some(path.to_string_lossy().to_string());
    }
    let stem = path.file_stem()?.to_str()?;
    let timestamp = stem.strip_prefix("imported-")?;
    let thumbnail_dir = assets_dir.join("thumbnails");
    for extension in ["png", "jpg", "jpeg", "webp", "gif"] {
        let candidate = thumbnail_dir.join(format!("thumb-{}.{}", timestamp, extension));
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    Some(path.to_string_lossy().to_string())
}

fn ensure_child_path(root: &Path, path: &Path) -> Result<(), String> {
    let root = root
        .canonicalize()
        .map_err(|error| format!("读取项目资源目录失败：{}；原因：{}", root.display(), error))?;
    let path = path
        .canonicalize()
        .map_err(|error| format!("读取资产路径失败：{}；原因：{}", path.display(), error))?;
    if !path.starts_with(&root) {
        return Err("资产路径不在当前项目目录内".to_string());
    }
    Ok(())
}

fn create_dir_all_with_context(path: &Path, action: &str) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("{}失败：{}；原因：{}", action, path.display(), error))
}
