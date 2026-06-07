use std::{fs, path::PathBuf};
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

fn workflow_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workflows").join("current.json"))
        .map_err(|error| error.to_string())
}
