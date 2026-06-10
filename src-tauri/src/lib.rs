mod workflow;

use workflow::commands::{
    cancel_run, copy_image_to_clipboard, import_clipboard_image, import_image_data_url,
    debug_frontend_logs, load_provider_configs, load_workflow, run_node, run_workflow, save_image_as,
    save_provider_configs, save_workflow, show_in_folder, RunControlState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RunControlState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_workflow,
            load_workflow,
            debug_frontend_logs,
            import_image_data_url,
            import_clipboard_image,
            save_image_as,
            show_in_folder,
            copy_image_to_clipboard,
            save_provider_configs,
            load_provider_configs,
            cancel_run,
            run_node,
            run_workflow
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
