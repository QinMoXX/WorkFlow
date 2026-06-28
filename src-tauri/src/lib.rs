mod workflow;

use workflow::commands::{
    cancel_run, copy_image_to_clipboard, create_workflow_project, debug_frontend_logs,
    delete_canvas_assets_dir, delete_project_asset, import_clipboard_image, import_image_data_url,
    list_project_assets, load_api_config, load_workflow, load_workflow_project,
    load_workflow_project_index, open_canvas_assets_dir, open_project_asset,
    rename_canvas_assets_dir, run_node, run_workflow, save_api_config, save_image_as,
    save_workflow, save_workflow_project, show_in_folder, switch_workflow_project,
    RunControlState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RunControlState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            save_workflow,
            load_workflow,
            save_workflow_project,
            load_workflow_project,
            load_workflow_project_index,
            create_workflow_project,
            switch_workflow_project,
            rename_canvas_assets_dir,
            delete_canvas_assets_dir,
            open_canvas_assets_dir,
            debug_frontend_logs,
            import_image_data_url,
            import_clipboard_image,
            list_project_assets,
            delete_project_asset,
            open_project_asset,
            save_image_as,
            show_in_folder,
            copy_image_to_clipboard,
            save_api_config,
            load_api_config,
            cancel_run,
            run_node,
            run_workflow
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
