use std::{borrow::Cow, fs, path::Path};

use arboard::{Clipboard, ImageData};
use tauri::AppHandle;

use super::{
    executor::run_nodes,
    graph::{execution_order_for_node, topological_order, validate_connections},
    models::{ImportedImage, RunResponse, WorkflowSnapshot},
    providers::{
        load_provider_configs as load_provider_config_list,
        save_provider_configs as save_provider_config_list, ProviderConfig,
    },
    storage::{
        load_workflow_snapshot, save_image_as_path, save_imported_data_url, save_workflow_snapshot,
        show_path_in_folder,
    },
};

#[tauri::command]
pub fn save_workflow(app: AppHandle, snapshot: WorkflowSnapshot) -> Result<(), String> {
    save_workflow_snapshot(&app, &snapshot)
}

#[tauri::command]
pub fn load_workflow(app: AppHandle) -> Result<Option<WorkflowSnapshot>, String> {
    load_workflow_snapshot(&app)
}

#[tauri::command]
pub fn import_image_data_url(
    app: AppHandle,
    data_url: String,
    thumbnail_data_url: Option<String>,
) -> Result<ImportedImage, String> {
    save_imported_data_url(&app, &data_url, thumbnail_data_url.as_deref())
}

#[tauri::command]
pub fn import_clipboard_image(
    app: AppHandle,
    data_url: String,
    thumbnail_data_url: Option<String>,
) -> Result<ImportedImage, String> {
    save_imported_data_url(&app, &data_url, thumbnail_data_url.as_deref())
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

    let bytes = fs::read(path).map_err(|error| format!("读取图片失败：{}", error))?;
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
pub fn save_provider_configs(app: AppHandle, providers: Vec<ProviderConfig>) -> Result<(), String> {
    save_provider_config_list(&app, &providers)
}

#[tauri::command]
pub fn load_provider_configs(app: AppHandle) -> Result<Vec<ProviderConfig>, String> {
    load_provider_config_list(&app)
}

#[tauri::command]
pub fn run_node(
    app: AppHandle,
    mut snapshot: WorkflowSnapshot,
    node_id: String,
) -> Result<RunResponse, String> {
    validate_connections(&snapshot)?;
    let providers = load_provider_config_list(&app)?;
    let execution_order = execution_order_for_node(&snapshot, &node_id)?;
    run_nodes(&app, &providers, &mut snapshot, execution_order)
}

#[tauri::command]
pub fn run_workflow(app: AppHandle, mut snapshot: WorkflowSnapshot) -> Result<RunResponse, String> {
    validate_connections(&snapshot)?;
    let providers = load_provider_config_list(&app)?;
    let execution_order = topological_order(&snapshot)?;
    run_nodes(&app, &providers, &mut snapshot, execution_order)
}
