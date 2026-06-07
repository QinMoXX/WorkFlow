use tauri::AppHandle;

use super::{
    executor::run_nodes,
    graph::{execution_order_for_node, topological_order, validate_connections},
    models::{RunResponse, WorkflowSnapshot},
    storage::{load_workflow_snapshot, save_workflow_snapshot},
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
pub fn run_node(
    app: AppHandle,
    mut snapshot: WorkflowSnapshot,
    node_id: String,
) -> Result<RunResponse, String> {
    validate_connections(&snapshot)?;
    let execution_order = execution_order_for_node(&snapshot, &node_id)?;
    run_nodes(&app, &mut snapshot, execution_order)
}

#[tauri::command]
pub fn run_workflow(app: AppHandle, mut snapshot: WorkflowSnapshot) -> Result<RunResponse, String> {
    validate_connections(&snapshot)?;
    let execution_order = topological_order(&snapshot)?;
    run_nodes(&app, &mut snapshot, execution_order)
}
