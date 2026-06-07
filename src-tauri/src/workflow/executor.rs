use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::AppHandle;

use super::{
    models::{RunResponse, WorkflowNodeKind, WorkflowSnapshot},
    providers::{validate_ai_node_provider, ProviderCapability, ProviderConfig},
    storage::generated_assets_dir,
};

pub fn run_nodes(
    app: &AppHandle,
    providers: &[ProviderConfig],
    snapshot: &mut WorkflowSnapshot,
    execution_order: Vec<String>,
) -> Result<RunResponse, String> {
    let mut logs = Vec::new();
    let generated_dir = generated_assets_dir(app)?;
    fs::create_dir_all(&generated_dir).map_err(|error| error.to_string())?;

    for node_id in execution_order {
        let index = snapshot
            .nodes
            .iter()
            .position(|node| node.id == node_id)
            .ok_or_else(|| format!("节点 {} 不存在", node_id))?;

        snapshot.nodes[index].data.status = "running".to_string();
        snapshot.nodes[index].data.error = None;

        match execute_node(snapshot, index, &generated_dir, providers) {
            Ok(log) => {
                snapshot.nodes[index].data.status = "success".to_string();
                logs.push(log);
            }
            Err(error) => {
                snapshot.nodes[index].data.status = "error".to_string();
                snapshot.nodes[index].data.error = Some(error.clone());
                logs.push(format!(
                    "{} 失败：{}",
                    snapshot.nodes[index].data.title, error
                ));
                return Ok(RunResponse {
                    snapshot: snapshot.clone(),
                    logs,
                });
            }
        }
    }

    Ok(RunResponse {
        snapshot: snapshot.clone(),
        logs,
    })
}

fn execute_node(
    snapshot: &mut WorkflowSnapshot,
    node_index: usize,
    generated_dir: &PathBuf,
    providers: &[ProviderConfig],
) -> Result<String, String> {
    let node = snapshot.nodes[node_index].clone();

    match node.kind {
        WorkflowNodeKind::TextInput => {
            let content = node.data.content.unwrap_or_default();
            if content.trim().is_empty() {
                return Err("文本内容为空".to_string());
            }
            Ok(format!("{} 输出文本", node.data.title))
        }
        WorkflowNodeKind::ImageInput => {
            let image_path = node.data.image_path.unwrap_or_default();
            if image_path.trim().is_empty() {
                return Err("图片路径为空".to_string());
            }
            snapshot.nodes[node_index].data.result_path = Some(image_path);
            Ok(format!("{} 输出图片路径", node.data.title))
        }
        WorkflowNodeKind::TextToImage => {
            validate_ai_node_provider(
                providers,
                node.data.provider_id.as_deref(),
                node.data.model.as_deref(),
                ProviderCapability::TextToImage,
            )?;
            let prompt = connected_text(snapshot, &node.id).or(node.data.prompt_override);
            if prompt.unwrap_or_default().trim().is_empty() {
                return Err("缺少 prompt 输入".to_string());
            }
            let result_path = simulated_image_path(generated_dir, &node.id)?;
            snapshot.nodes[node_index].data.result_path = Some(result_path.clone());
            Ok(format!("{} 生成图片：{}", node.data.title, result_path))
        }
        WorkflowNodeKind::ImageToImage => {
            validate_ai_node_provider(
                providers,
                node.data.provider_id.as_deref(),
                node.data.model.as_deref(),
                ProviderCapability::ImageToImage,
            )?;
            let prompt = connected_text(snapshot, &node.id).or(node.data.prompt_override);
            let image = connected_image(snapshot, &node.id);
            if image.unwrap_or_default().trim().is_empty() {
                return Err("缺少图片输入".to_string());
            }
            if prompt.unwrap_or_default().trim().is_empty() {
                return Err("缺少 prompt 输入".to_string());
            }
            let result_path = simulated_image_path(generated_dir, &node.id)?;
            snapshot.nodes[node_index].data.result_path = Some(result_path.clone());
            Ok(format!("{} 生成图片：{}", node.data.title, result_path))
        }
        WorkflowNodeKind::Output => {
            let image =
                connected_image(snapshot, &node.id).ok_or_else(|| "缺少图片输入".to_string())?;
            snapshot.nodes[node_index].data.last_output_path = Some(image.clone());
            Ok(format!("{} 接收输出：{}", node.data.title, image))
        }
    }
}

fn connected_text(snapshot: &WorkflowSnapshot, target_id: &str) -> Option<String> {
    snapshot
        .edges
        .iter()
        .find(|edge| edge.target == target_id && edge.target_handle.as_deref() == Some("prompt-in"))
        .and_then(|edge| snapshot.nodes.iter().find(|node| node.id == edge.source))
        .and_then(|node| match node.kind {
            WorkflowNodeKind::TextInput => node.data.content.clone(),
            _ => None,
        })
}

fn connected_image(snapshot: &WorkflowSnapshot, target_id: &str) -> Option<String> {
    snapshot
        .edges
        .iter()
        .find(|edge| edge.target == target_id && edge.target_handle.as_deref() == Some("image-in"))
        .and_then(|edge| snapshot.nodes.iter().find(|node| node.id == edge.source))
        .and_then(|node| {
            node.data
                .result_path
                .clone()
                .or_else(|| node.data.image_path.clone())
                .or_else(|| node.data.last_output_path.clone())
        })
}

fn simulated_image_path(generated_dir: &PathBuf, node_id: &str) -> Result<String, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    Ok(generated_dir
        .join(format!("{}_{}.png", node_id, timestamp))
        .to_string_lossy()
        .into_owned())
}
