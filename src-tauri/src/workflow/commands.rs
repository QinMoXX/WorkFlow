use std::{
    borrow::Cow,
    collections::HashSet,
    fs,
    path::Path,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};

use arboard::{Clipboard, ImageData};
use tauri::{AppHandle, State};

use super::{
    executor::run_nodes,
    graph::{execution_order_for_node, topological_order, validate_connections},
    models::{
        ImportedImage, ProjectAsset, RunResponse, WorkflowProject, WorkflowProjectIndex,
        WorkflowSnapshot,
    },
    providers::{
        load_api_config as load_api_config_value, load_runtime_provider,
        save_api_config as save_api_config_value, ApiConfig,
    },
    storage::{
        create_workflow_project as create_workflow_project_value,
        delete_canvas_assets_dir as delete_canvas_assets_dir_value,
        delete_project_asset as delete_project_asset_value,
        list_project_assets as list_project_assets_value,
        load_workflow_project as load_workflow_project_value,
        load_workflow_project_index as load_workflow_project_index_value, load_workflow_snapshot,
        open_canvas_assets_dir as open_canvas_assets_dir_value,
        open_project_asset as open_project_asset_value,
        rename_canvas_assets_dir as rename_canvas_assets_dir_value, save_image_as_path,
        save_imported_data_url, save_workflow_project as save_workflow_project_value,
        save_workflow_snapshot, show_path_in_folder,
        switch_workflow_project as switch_workflow_project_value,
    },
};

static RUN_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Default)]
pub struct RunControlState {
    cancelled_run_ids: Arc<Mutex<HashSet<String>>>,
}

impl RunControlState {
    pub fn cancel(&self, run_id: &str) -> Result<(), String> {
        let mut cancelled = self
            .cancelled_run_ids
            .lock()
            .map_err(|_| "运行控制状态已损坏".to_string())?;
        cancelled.insert(run_id.to_string());
        Ok(())
    }

    pub fn is_cancelled(&self, run_id: &str) -> bool {
        self.cancelled_run_ids
            .lock()
            .map(|cancelled| cancelled.contains(run_id))
            .unwrap_or(true)
    }

    pub fn clear(&self, run_id: &str) {
        if let Ok(mut cancelled) = self.cancelled_run_ids.lock() {
            cancelled.remove(run_id);
        }
    }
}

#[tauri::command]
pub fn save_workflow(app: AppHandle, snapshot: WorkflowSnapshot) -> Result<(), String> {
    save_workflow_snapshot(&app, &snapshot)
}

#[tauri::command]
pub fn load_workflow(app: AppHandle) -> Result<Option<WorkflowSnapshot>, String> {
    load_workflow_snapshot(&app)
}

#[tauri::command]
pub fn save_workflow_project(app: AppHandle, project: WorkflowProject) -> Result<(), String> {
    save_workflow_project_value(&app, &project)
}

#[tauri::command]
pub fn load_workflow_project(app: AppHandle) -> Result<WorkflowProject, String> {
    load_workflow_project_value(&app)
}

#[tauri::command]
pub fn load_workflow_project_index(app: AppHandle) -> Result<WorkflowProjectIndex, String> {
    load_workflow_project_index_value(&app)
}

#[tauri::command]
pub fn create_workflow_project(app: AppHandle, name: String) -> Result<WorkflowProject, String> {
    create_workflow_project_value(&app, &name)
}

#[tauri::command]
pub fn switch_workflow_project(
    app: AppHandle,
    project_id: String,
) -> Result<WorkflowProject, String> {
    switch_workflow_project_value(&app, &project_id)
}

#[tauri::command]
pub fn rename_canvas_assets_dir(
    app: AppHandle,
    project: WorkflowProject,
    canvas_id: String,
    next_name: String,
) -> Result<String, String> {
    rename_canvas_assets_dir_value(&app, &project, &canvas_id, &next_name)
}

#[tauri::command]
pub fn delete_canvas_assets_dir(
    app: AppHandle,
    project: WorkflowProject,
    canvas_id: String,
) -> Result<(), String> {
    delete_canvas_assets_dir_value(&app, &project, &canvas_id)
}

#[tauri::command]
pub fn open_canvas_assets_dir(
    app: AppHandle,
    project: WorkflowProject,
    canvas_id: String,
) -> Result<(), String> {
    open_canvas_assets_dir_value(&app, &project, &canvas_id)
}

#[tauri::command]
pub fn debug_frontend_logs(messages: Vec<String>) {
    #[cfg(debug_assertions)]
    for message in messages {
        println!("[frontend] {}", message);
    }

    #[cfg(not(debug_assertions))]
    let _ = messages;
}

#[tauri::command]
pub fn import_image_data_url(
    app: AppHandle,
    project_id: String,
    data_url: String,
    thumbnail_data_url: Option<String>,
) -> Result<ImportedImage, String> {
    save_imported_data_url(&app, &project_id, &data_url, thumbnail_data_url.as_deref())
}

#[tauri::command]
pub fn import_clipboard_image(
    app: AppHandle,
    project_id: String,
    data_url: String,
    thumbnail_data_url: Option<String>,
) -> Result<ImportedImage, String> {
    save_imported_data_url(&app, &project_id, &data_url, thumbnail_data_url.as_deref())
}

#[tauri::command]
pub fn list_project_assets(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<ProjectAsset>, String> {
    list_project_assets_value(&app, &project_id)
}

#[tauri::command]
pub fn delete_project_asset(
    app: AppHandle,
    project_id: String,
    asset_path: String,
) -> Result<(), String> {
    delete_project_asset_value(&app, &project_id, &asset_path)
}

#[tauri::command]
pub fn open_project_asset(
    app: AppHandle,
    project_id: String,
    asset_path: String,
) -> Result<(), String> {
    open_project_asset_value(&app, &project_id, &asset_path)
}

#[tauri::command]
pub fn check_local_image_source(image_path: String) -> Result<bool, String> {
    let image_path = image_path.trim();
    let normalized = image_path.to_ascii_lowercase();
    if image_path.is_empty() || is_direct_image_source(&normalized) {
        return Ok(true);
    }

    let path = local_image_path(image_path);
    Ok(path.is_file())
}

#[tauri::command]
pub fn save_image_as(image_path: String, destination_path: String) -> Result<String, String> {
    save_image_as_path(&image_path, &destination_path)
}

#[tauri::command]
pub fn show_in_folder(image_path: String) -> Result<(), String> {
    show_path_in_folder(&image_path)
}

#[tauri::command]
pub fn copy_image_to_clipboard(image_path: String) -> Result<(), String> {
    let path = Path::new(&image_path);
    if !path.exists() {
        return Err(format!("图片不存在：{}", image_path));
    }

    let bytes = fs::read(path)
        .map_err(|error| format!("读取图片失败：{}；原因：{}", path.display(), error))?;
    let image = image::load_from_memory(&bytes)
        .map_err(|error| format!("解析图片失败：{}；原因：{}", image_path, error))?
        .to_rgba8();
    let (width, height) = image.dimensions();
    let data = ImageData {
        width: width as usize,
        height: height as usize,
        bytes: Cow::Owned(image.into_raw()),
    };

    let mut clipboard =
        Clipboard::new().map_err(|error| format!("打开系统剪切板失败：{}", error))?;
    clipboard
        .set_image(data)
        .map_err(|error| format!("复制图片到剪切板失败：{}", error))
}

#[tauri::command]
pub fn save_api_config(app: AppHandle, config: ApiConfig) -> Result<(), String> {
    save_api_config_value(&app, &config)
}

#[tauri::command]
pub fn load_api_config(app: AppHandle) -> Result<ApiConfig, String> {
    load_api_config_value(&app)
}

#[tauri::command]
pub fn cancel_run(state: State<'_, RunControlState>, run_id: String) -> Result<(), String> {
    if run_id.trim().is_empty() {
        return Err("运行 ID 为空".to_string());
    }
    state.cancel(run_id.trim())
}

#[tauri::command]
pub async fn run_node(
    app: AppHandle,
    state: State<'_, RunControlState>,
    project_id: String,
    snapshot: WorkflowSnapshot,
    node_id: String,
) -> Result<RunResponse, String> {
    let run_id = create_run_id();
    let run_control = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut snapshot = snapshot;
        validate_connections(&snapshot)?;
        let provider = load_runtime_provider(&app)?;
        let execution_order = execution_order_for_node(&snapshot, &node_id)?;
        run_nodes(
            &app,
            &project_id,
            &provider,
            &mut snapshot,
            execution_order,
            "node",
            Some(node_id),
            run_id,
            &run_control,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn run_workflow(
    app: AppHandle,
    state: State<'_, RunControlState>,
    project_id: String,
    snapshot: WorkflowSnapshot,
) -> Result<RunResponse, String> {
    let run_id = create_run_id();
    let run_control = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut snapshot = snapshot;
        validate_connections(&snapshot)?;
        let provider = load_runtime_provider(&app)?;
        let execution_order = topological_order(&snapshot)?;
        run_nodes(
            &app,
            &project_id,
            &provider,
            &mut snapshot,
            execution_order,
            "workflow",
            None,
            run_id,
            &run_control,
        )
    })
    .await
    .map_err(|error| error.to_string())?
}

fn create_run_id() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let sequence = RUN_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    format!("run-{}-{}-{}", millis, std::process::id(), sequence)
}

fn local_image_path(image_path: &str) -> std::path::PathBuf {
    if let Some(rest) = image_path.strip_prefix("file:///") {
        #[cfg(target_os = "windows")]
        {
            return std::path::PathBuf::from(rest.replace('/', "\\"));
        }
        #[cfg(not(target_os = "windows"))]
        {
            return std::path::PathBuf::from(format!("/{}", rest));
        }
    }
    if let Some(rest) = image_path.strip_prefix("file://") {
        return std::path::PathBuf::from(rest);
    }
    std::path::PathBuf::from(image_path)
}

fn is_direct_image_source(image_path: &str) -> bool {
    image_path.starts_with("http://")
        || image_path.starts_with("https://")
        || image_path.starts_with("data:image/")
        || image_path.starts_with("blob:")
        || image_path.starts_with("asset:")
        || image_path.starts_with("tauri:")
}
