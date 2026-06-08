use tauri::AppHandle;

use super::{
    executor::run_nodes,
    graph::{execution_order_for_node, topological_order, validate_connections},
    models::{RunResponse, WorkflowSnapshot},
    providers::{
        load_provider_configs as load_provider_config_list,
        save_provider_configs as save_provider_config_list, ProviderConfig,
    },
    storage::{load_workflow_snapshot, save_imported_data_url, save_workflow_snapshot},
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
pub fn import_clipboard_image(app: AppHandle, data_url: String) -> Result<String, String> {
    save_imported_data_url(&app, &data_url)
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
