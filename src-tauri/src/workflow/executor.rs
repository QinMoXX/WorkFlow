use std::{fs, path::PathBuf};
use tauri::AppHandle;

use super::{
    image_provider::{
        ImageProvider, ImageToImageInput, OpenAiCompatibleImageProvider, TextToImageInput,
    },
    models::{RunResponse, WorkflowNodeKind, WorkflowSnapshot},
    providers::{resolve_ai_node_provider, ProviderCapability, ProviderConfig},
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
            let provider = resolve_ai_node_provider(
                providers,
                node.data.provider_id.as_deref(),
                node.data.model.as_deref(),
                ProviderCapability::TextToImage,
            )?;
            let prompt = connected_text(snapshot, &node.id).or(node.data.prompt_override);
            let prompt = prompt.unwrap_or_default();
            if prompt.trim().is_empty() {
                return Err("缺少 prompt 输入".to_string());
            }
            let model = node.data.model.clone().unwrap_or_default();
            let image_provider = OpenAiCompatibleImageProvider::new(provider, generated_dir)?;
            let result = image_provider.text_to_image(TextToImageInput {
                node_id: node.id,
                model: model.clone(),
                prompt,
                size: size_from_aspect_ratio(node.data.aspect_ratio.as_deref()),
                seed: parse_seed(node.data.seed.as_deref())?,
            })?;
            snapshot.nodes[node_index].data.result_path = Some(result.local_path.clone());
            snapshot.nodes[node_index].data.result_url = Some(result.remote_url);
            Ok(format!(
                "{} 通过 {} / {} 生成图片：{}",
                node.data.title, provider.name, model, result.local_path
            ))
        }
        WorkflowNodeKind::ImageToImage => {
            let provider = resolve_ai_node_provider(
                providers,
                node.data.provider_id.as_deref(),
                node.data.model.as_deref(),
                ProviderCapability::ImageToImage,
            )?;
            let prompt = connected_text(snapshot, &node.id).or(node.data.prompt_override);
            let prompt = prompt.unwrap_or_default();
            if prompt.trim().is_empty() {
                return Err("缺少 prompt 输入".to_string());
            }
            let image_url =
                connected_image_url(snapshot, &node.id).ok_or_else(|| "缺少可用于 API 的图片 URL；当前图生图阶段仅支持远程图片 URL 或上游 AI 节点结果 URL".to_string())?;
            let model = node.data.model.clone().unwrap_or_default();
            let image_provider = OpenAiCompatibleImageProvider::new(provider, generated_dir)?;
            let result = image_provider.image_to_image(ImageToImageInput {
                node_id: node.id,
                model: model.clone(),
                prompt,
                image_url,
                size: size_from_aspect_ratio(node.data.aspect_ratio.as_deref()),
                seed: parse_seed(node.data.seed.as_deref())?,
            })?;
            snapshot.nodes[node_index].data.result_path = Some(result.local_path.clone());
            snapshot.nodes[node_index].data.result_url = Some(result.remote_url);
            Ok(format!(
                "{} 通过 {} / {} 生成图片：{}",
                node.data.title, provider.name, model, result.local_path
            ))
        }
        WorkflowNodeKind::Output => {
            let image =
                connected_image(snapshot, &node.id).ok_or_else(|| "缺少图片输入".to_string())?;
            snapshot.nodes[node_index].data.last_output_path = Some(image.clone());
            Ok(format!("{} 接收输出：{}", node.data.title, image))
        }
    }
}

fn connected_image_url(snapshot: &WorkflowSnapshot, target_id: &str) -> Option<String> {
    snapshot
        .edges
        .iter()
        .find(|edge| edge.target == target_id && edge.target_handle.as_deref() == Some("image-in"))
        .and_then(|edge| snapshot.nodes.iter().find(|node| node.id == edge.source))
        .and_then(|node| {
            node.data.result_url.clone().or_else(|| {
                node.data
                    .image_path
                    .clone()
                    .filter(|value| is_remote_url(value))
            })
        })
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

fn size_from_aspect_ratio(aspect_ratio: Option<&str>) -> Option<String> {
    let size = match aspect_ratio.unwrap_or("1:1") {
        "4:3" => "1024x768",
        "3:4" => "768x1024",
        "16:9" => "1024x576",
        "9:16" => "576x1024",
        _ => "1024x1024",
    };
    Some(size.to_string())
}

fn parse_seed(seed: Option<&str>) -> Result<Option<i64>, String> {
    seed.filter(|value| !value.trim().is_empty())
        .map(|value| {
            value
                .trim()
                .parse::<i64>()
                .map_err(|_| format!("Seed 必须是整数：{}", value))
        })
        .transpose()
}

fn is_remote_url(value: &str) -> bool {
    value.starts_with("http://") || value.starts_with("https://")
}
