use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use reqwest::Url;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::{Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};

use super::{
    commands::RunControlState,
    image_provider::{ImageGenerationInput, ImageProvider, OpenAiCompatibleImageProvider},
    models::{
        RunError, RunFinishedEvent, RunLogEvent, RunNodeEvent, RunNodeMetrics, RunNodeOutput,
        RunNodeSnapshot, RunResponse, RunStartedEvent, RunSummary, WorkflowDataType,
        WorkflowNodeKind, WorkflowSnapshot,
    },
    providers::{resolve_ai_node_provider, ProviderCapability, ProviderConfig},
    storage::{generated_assets_dir, output_assets_dir},
};

pub fn run_nodes(
    app: &AppHandle,
    canvas_id: &str,
    provider: &ProviderConfig,
    snapshot: &mut WorkflowSnapshot,
    execution_order: Vec<String>,
    mode: &str,
    target_node_id: Option<String>,
    run_id: String,
    run_control: &RunControlState,
) -> Result<RunResponse, String> {
    let mut logs = Vec::new();
    let mut sequence = 0;
    let mut failed_nodes = HashSet::new();
    let started_at = timestamp();
    let run_timer = Instant::now();
    let generated_dir = generated_assets_dir(app, canvas_id)?;
    let output_dir = output_assets_dir(app, canvas_id)?;
    fs::create_dir_all(&generated_dir).map_err(|error| {
        format!(
            "创建生成图片目录失败：{}；原因：{}",
            generated_dir.display(),
            error
        )
    })?;
    fs::create_dir_all(&output_dir).map_err(|error| {
        format!(
            "创建输出图片目录失败：{}；原因：{}",
            output_dir.display(),
            error
        )
    })?;
    emit_started(
        app,
        RunStartedEvent {
            run_id: run_id.clone(),
            mode: mode.to_string(),
            target_node_id: target_node_id.clone(),
            node_ids: execution_order.clone(),
            started_at: started_at.clone(),
        },
    );

    for node_id in &execution_order {
        let index = snapshot
            .nodes
            .iter()
            .position(|node| node.id == *node_id)
            .ok_or_else(|| format!("节点 {} 不存在", node_id))?;

        if run_control.is_cancelled(&run_id) {
            let message = "运行已打断，节点未执行".to_string();
            reset_cancelled_node_runtime(snapshot, index);
            logs.push(format!(
                "{} 已打断：{}",
                snapshot.nodes[index].data.title, message
            ));
            emit_log(
                app,
                &run_id,
                &mut sequence,
                "warn",
                &logs[logs.len() - 1],
                Some(node_id),
            );
            sequence += 1;
            emit_node(
                app,
                &run_id,
                &mut sequence,
                snapshot,
                index,
                None,
                Some(run_error(
                    "cancellation",
                    "runCancelled",
                    message,
                    Some(node_id.clone()),
                    None,
                    false,
                )),
                None,
            );
            continue;
        }

        if let Some(cause_node_id) = upstream_failure(snapshot, node_id, &failed_nodes) {
            let message = "上游节点失败，当前节点未执行".to_string();
            snapshot.nodes[index].data.status = "blocked".to_string();
            snapshot.nodes[index].data.error = Some(message.clone());
            logs.push(format!(
                "{} 阻塞：{}",
                snapshot.nodes[index].data.title, message
            ));
            sequence += 1;
            emit_node(
                app,
                &run_id,
                &mut sequence,
                snapshot,
                index,
                None,
                Some(run_error(
                    "validation",
                    "upstreamFailed",
                    message,
                    Some(node_id.clone()),
                    Some(cause_node_id),
                    false,
                )),
                None,
            );
            continue;
        }

        if target_node_id.is_some()
            && target_node_id.as_deref() != Some(node_id.as_str())
            && reusable_node_output(snapshot, index).is_some()
        {
            snapshot.nodes[index].data.status = "success".to_string();
            snapshot.nodes[index].data.error = None;
            logs.push(format!("{} 复用已有结果", snapshot.nodes[index].data.title));
            emit_log(
                app,
                &run_id,
                &mut sequence,
                "info",
                &logs[logs.len() - 1],
                Some(node_id),
            );
            sequence += 1;
            emit_node(
                app,
                &run_id,
                &mut sequence,
                snapshot,
                index,
                node_output(snapshot, index),
                None,
                Some(node_metrics(
                    snapshot,
                    index,
                    provider,
                    None,
                    None,
                    Some(timestamp()),
                    Some(0),
                )),
            );
            continue;
        }

        snapshot.nodes[index].data.status = "running".to_string();
        snapshot.nodes[index].data.error = None;
        snapshot.nodes[index].data.progress = Some(10);
        let node_started_at = timestamp();
        let node_timer = Instant::now();
        sequence += 1;
        emit_node(
            app,
            &run_id,
            &mut sequence,
            snapshot,
            index,
            None,
            None,
            Some(node_metrics(
                snapshot,
                index,
                provider,
                None,
                Some(node_started_at.clone()),
                None,
                None,
            )),
        );

        match execute_node(snapshot, index, &generated_dir, &output_dir, provider) {
            Ok(log) => {
                if run_control.is_cancelled(&run_id) {
                    let message = "运行已打断，当前节点结果已忽略".to_string();
                    reset_cancelled_node_runtime(snapshot, index);
                    logs.push(format!(
                        "{} 已打断：{}",
                        snapshot.nodes[index].data.title, message
                    ));
                    emit_log(
                        app,
                        &run_id,
                        &mut sequence,
                        "warn",
                        &logs[logs.len() - 1],
                        Some(node_id),
                    );
                    sequence += 1;
                    emit_node(
                        app,
                        &run_id,
                        &mut sequence,
                        snapshot,
                        index,
                        None,
                        Some(run_error(
                            "cancellation",
                            "runCancelled",
                            message,
                            Some(node_id.clone()),
                            None,
                            false,
                        )),
                        Some(node_metrics(
                            snapshot,
                            index,
                            provider,
                            None,
                            Some(node_started_at),
                            Some(timestamp()),
                            Some(node_timer.elapsed().as_millis()),
                        )),
                    );
                    continue;
                }
                snapshot.nodes[index].data.status = "success".to_string();
                snapshot.nodes[index].data.progress = Some(100);
                let finished_at = timestamp();
                let duration_ms = node_timer.elapsed().as_millis();
                logs.push(format!("{}，耗时 {} ms", log, duration_ms));
                emit_log(
                    app,
                    &run_id,
                    &mut sequence,
                    "info",
                    &logs[logs.len() - 1],
                    Some(node_id),
                );
                sequence += 1;
                emit_node(
                    app,
                    &run_id,
                    &mut sequence,
                    snapshot,
                    index,
                    node_output(snapshot, index),
                    None,
                    Some(node_metrics(
                        snapshot,
                        index,
                        provider,
                        None,
                        Some(node_started_at),
                        Some(finished_at),
                        Some(duration_ms),
                    )),
                );
            }
            Err(error) => {
                if run_control.is_cancelled(&run_id) {
                    let message = "运行已打断，当前节点错误已忽略".to_string();
                    reset_cancelled_node_runtime(snapshot, index);
                    logs.push(format!(
                        "{} 已打断：{}",
                        snapshot.nodes[index].data.title, message
                    ));
                    emit_log(
                        app,
                        &run_id,
                        &mut sequence,
                        "warn",
                        &logs[logs.len() - 1],
                        Some(node_id),
                    );
                    sequence += 1;
                    emit_node(
                        app,
                        &run_id,
                        &mut sequence,
                        snapshot,
                        index,
                        None,
                        Some(run_error(
                            "cancellation",
                            "runCancelled",
                            message,
                            Some(node_id.clone()),
                            None,
                            false,
                        )),
                        Some(node_metrics(
                            snapshot,
                            index,
                            provider,
                            None,
                            Some(node_started_at),
                            Some(timestamp()),
                            Some(node_timer.elapsed().as_millis()),
                        )),
                    );
                    continue;
                }
                snapshot.nodes[index].data.status = "error".to_string();
                snapshot.nodes[index].data.error = Some(error.clone());
                snapshot.nodes[index].data.progress = None;
                failed_nodes.insert(node_id.clone());
                logs.push(format!(
                    "{} 失败：{}",
                    snapshot.nodes[index].data.title, error
                ));
                emit_log(
                    app,
                    &run_id,
                    &mut sequence,
                    "error",
                    &logs[logs.len() - 1],
                    Some(node_id),
                );
                sequence += 1;
                let error_kind = classify_error(&error).to_string();
                emit_node(
                    app,
                    &run_id,
                    &mut sequence,
                    snapshot,
                    index,
                    None,
                    Some(run_error(
                        &error_kind,
                        "nodeFailed",
                        error,
                        Some(node_id.clone()),
                        None,
                        true,
                    )),
                    Some(node_metrics(
                        snapshot,
                        index,
                        provider,
                        None,
                        Some(node_started_at),
                        Some(timestamp()),
                        Some(node_timer.elapsed().as_millis()),
                    )),
                );
            }
        }
    }

    let summary = run_summary(snapshot, &execution_order);
    let was_cancelled = run_control.is_cancelled(&run_id);
    emit_finished(
        app,
        RunFinishedEvent {
            run_id: run_id.clone(),
            status: if was_cancelled {
                "cancelled"
            } else if summary.error > 0 {
                "error"
            } else {
                "success"
            }
            .to_string(),
            started_at,
            finished_at: timestamp(),
            duration_ms: run_timer.elapsed().as_millis(),
            summary,
            error: None,
        },
    );

    run_control.clear(&run_id);
    Ok(RunResponse {
        snapshot: snapshot.clone(),
        logs,
        run_id,
    })
}

fn execute_node(
    snapshot: &mut WorkflowSnapshot,
    node_index: usize,
    generated_dir: &PathBuf,
    output_dir: &Path,
    provider: &ProviderConfig,
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
            let image_path = image_path.trim().to_string();
            validate_image_input_source(&image_path)?;
            snapshot.nodes[node_index].data.result_path = Some(image_path);
            Ok(format!("{} 输出图片路径", node.data.title))
        }
        WorkflowNodeKind::ImageGeneration
        | WorkflowNodeKind::TextToImage
        | WorkflowNodeKind::ImageToImage => {
            let provider = resolve_ai_node_provider(
                provider,
                node.data.model.as_deref(),
                ProviderCapability::ImageGeneration,
                node.kind,
            )?;
            let prompt = connected_text(snapshot, &node.id).or(node.data.prompt_override);
            let prompt = prompt.unwrap_or_default();
            if prompt.trim().is_empty() {
                return Err("缺少 prompt 输入".to_string());
            }
            let image_source = connected_image_source(snapshot, &node.id)?;
            let model = node.data.model.clone().unwrap_or_default();
            snapshot.nodes[node_index].data.progress = Some(18);
            let image_provider = OpenAiCompatibleImageProvider::new(provider, generated_dir)?;
            let result = image_provider.generate_image(ImageGenerationInput {
                node_id: node.id,
                model: model.clone(),
                prompt,
                image_source,
                size: size_from_aspect_ratio(node.data.aspect_ratio.as_deref()),
                seed: parse_seed(node.data.seed.as_deref())?,
            })?;
            snapshot.nodes[node_index].data.result_path = Some(result.local_path.clone());
            if !result.remote_url.is_empty() {
                snapshot.nodes[node_index].data.result_url = Some(result.remote_url);
            }
            Ok(format!(
                "{} 通过 {} / {} 生成图片：{}",
                node.data.title, provider.name, model, result.local_path
            ))
        }
        WorkflowNodeKind::Output => {
            let image =
                connected_image(snapshot, &node.id).ok_or_else(|| "缺少图片输入".to_string())?;
            let output_path = match node.data.save_directory.as_deref() {
                Some(directory) if !directory.trim().is_empty() => {
                    copy_output_image(&image, directory.trim(), &node.id)?
                }
                _ => copy_output_image(&image, &output_dir.to_string_lossy(), &node.id)?,
            };
            snapshot.nodes[node_index].data.last_output_path = Some(output_path.clone());

            if output_path == image {
                Ok(format!("{} 接收输出：{}", node.data.title, output_path))
            } else {
                Ok(format!("{} 保存输出：{}", node.data.title, output_path))
            }
        }
        WorkflowNodeKind::Group => Ok(format!("{} 为视觉分组，无需执行", node.data.title)),
    }
}

fn reset_cancelled_node_runtime(snapshot: &mut WorkflowSnapshot, node_index: usize) {
    let node = &mut snapshot.nodes[node_index];
    node.data.status = "idle".to_string();
    node.data.error = None;
    node.data.progress = None;

    match node.kind {
        WorkflowNodeKind::ImageGeneration
        | WorkflowNodeKind::TextToImage
        | WorkflowNodeKind::ImageToImage => {
            node.data.result_path = None;
            node.data.result_url = None;
        }
        WorkflowNodeKind::Output => {
            node.data.last_output_path = None;
        }
        _ => {}
    }
}

fn copy_output_image(
    image_path: &str,
    save_directory: &str,
    node_id: &str,
) -> Result<String, String> {
    if is_remote_url(image_path) {
        return Err("输出节点当前只能保存本地图片路径，不能直接保存远程 URL".to_string());
    }

    let source = Path::new(image_path);
    if !source.exists() {
        return Err(format!("输出图片不存在：{}", image_path));
    }
    if !source.is_file() {
        return Err(format!("输出图片路径不是文件：{}", source.display()));
    }

    let directory = Path::new(save_directory);
    fs::create_dir_all(directory)
        .map_err(|error| format!("创建输出目录失败：{}；原因：{}", save_directory, error))?;

    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("png");
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let destination = directory.join(format!("{}-{}.{}", node_id, timestamp, extension));

    fs::copy(source, &destination).map_err(|error| {
        format!(
            "保存输出图片失败：{}；原因：{}",
            destination.display(),
            error
        )
    })?;

    Ok(destination.to_string_lossy().to_string())
}

fn connected_image_source(
    snapshot: &WorkflowSnapshot,
    target_id: &str,
) -> Result<Option<String>, String> {
    let image = snapshot
        .edges
        .iter()
        .find(|edge| edge.target == target_id && edge.target_handle.as_deref() == Some("image-in"))
        .and_then(|edge| snapshot.nodes.iter().find(|node| node.id == edge.source))
        .and_then(|node| {
            node.data
                .result_url
                .clone()
                .or_else(|| node.data.result_path.clone())
                .or_else(|| node.data.image_path.clone())
                .or_else(|| node.data.last_output_path.clone())
        })
        .map(|image| image_to_api_source(&image))
        .transpose()?;

    Ok(image)
}

fn image_to_api_source(image: &str) -> Result<String, String> {
    if is_remote_url(image) || image.starts_with("data:image/") {
        return Ok(image.to_string());
    }

    let path = Path::new(image);
    if !path.exists() {
        return Err(format!("图生图输入图片不存在：{}", image));
    }
    let bytes = fs::read(path).map_err(|error| {
        format!(
            "读取图生图输入图片失败：{}；原因：{}",
            path.display(),
            error
        )
    })?;
    let mime_type = image_mime_type(path)?;

    Ok(format!(
        "data:{};base64,{}",
        mime_type,
        BASE64_STANDARD.encode(bytes)
    ))
}

fn image_mime_type(path: &Path) -> Result<&'static str, String> {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "jpg" | "jpeg" => Ok("image/jpeg"),
        "png" => Ok("image/png"),
        "webp" => Ok("image/webp"),
        "gif" => Ok("image/gif"),
        extension => Err(format!(
            "图生图输入图片格式不支持：{}；支持 jpg、jpeg、png、webp、gif",
            if extension.is_empty() {
                "(无扩展名)"
            } else {
                extension
            }
        )),
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

fn validate_image_input_source(image: &str) -> Result<(), String> {
    if image.starts_with("data:image/") {
        return Ok(());
    }

    if image.starts_with("http://") || image.starts_with("https://") {
        Url::parse(image).map_err(|error| {
            format!(
                "图片输入 URL 无效：{}；原因：{}",
                truncate_value(image, 180),
                error
            )
        })?;
        return Ok(());
    }

    let path = Path::new(image);
    if !path.exists() {
        return Err(format!("图片输入文件不存在：{}", path.display()));
    }
    if !path.is_file() {
        return Err(format!("图片输入路径不是文件：{}", path.display()));
    }
    fs::metadata(path).map_err(|error| {
        format!(
            "读取图片输入文件信息失败：{}；原因：{}",
            path.display(),
            error
        )
    })?;
    Ok(())
}

fn truncate_value(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let truncated: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        format!("{}...", truncated)
    } else {
        truncated
    }
}

fn timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn emit_started(app: &AppHandle, payload: RunStartedEvent) {
    let _ = app.emit("workflow://run/started", payload);
}

fn emit_finished(app: &AppHandle, payload: RunFinishedEvent) {
    let _ = app.emit("workflow://run/finished", payload);
}

fn emit_log(
    app: &AppHandle,
    run_id: &str,
    sequence: &mut u64,
    level: &str,
    message: &str,
    node_id: Option<&String>,
) {
    *sequence += 1;
    let _ = app.emit(
        "workflow://run/log",
        RunLogEvent {
            run_id: run_id.to_string(),
            sequence: *sequence,
            timestamp: timestamp(),
            level: level.to_string(),
            message: message.to_string(),
            node_id: node_id.cloned(),
            code: None,
        },
    );
}

fn emit_node(
    app: &AppHandle,
    run_id: &str,
    sequence: &mut u64,
    snapshot: &WorkflowSnapshot,
    node_index: usize,
    output: Option<RunNodeOutput>,
    error: Option<RunError>,
    metrics: Option<RunNodeMetrics>,
) {
    let node = &snapshot.nodes[node_index];
    let _ = app.emit(
        "workflow://run/node",
        RunNodeEvent {
            run_id: run_id.to_string(),
            node_id: node.id.clone(),
            status: node.data.status.clone(),
            sequence: *sequence,
            timestamp: timestamp(),
            node: RunNodeSnapshot {
                id: node.id.clone(),
                title: node.data.title.clone(),
                kind: node.kind,
                status: node.data.status.clone(),
                result_path: node.data.result_path.clone(),
                result_url: node.data.result_url.clone(),
                last_output_path: node.data.last_output_path.clone(),
                progress: node.data.progress,
                error: node.data.error.clone(),
            },
            output,
            error,
            metrics,
        },
    );
}

fn run_error(
    kind: &str,
    code: &str,
    message: String,
    node_id: Option<String>,
    cause_node_id: Option<String>,
    retryable: bool,
) -> RunError {
    RunError {
        kind: kind.to_string(),
        code: code.to_string(),
        message,
        node_id,
        cause_node_id,
        retryable,
    }
}

fn node_output(snapshot: &WorkflowSnapshot, node_index: usize) -> Option<RunNodeOutput> {
    let node = &snapshot.nodes[node_index];
    let data_type = match node.kind {
        WorkflowNodeKind::TextInput => Some(WorkflowDataType::Text),
        WorkflowNodeKind::ImageInput
        | WorkflowNodeKind::ImageGeneration
        | WorkflowNodeKind::TextToImage
        | WorkflowNodeKind::ImageToImage => Some(WorkflowDataType::Image),
        WorkflowNodeKind::Output => Some(WorkflowDataType::Image),
        WorkflowNodeKind::Group => None,
    };

    Some(RunNodeOutput {
        data_type,
        local_path: node
            .data
            .result_path
            .clone()
            .or_else(|| node.data.image_path.clone())
            .or_else(|| node.data.last_output_path.clone()),
        remote_url: node.data.result_url.clone(),
        thumbnail_path: node.data.thumbnail_path.clone(),
        text_preview: node
            .data
            .content
            .clone()
            .map(|value| value.chars().take(80).collect()),
    })
}

fn reusable_node_output(snapshot: &WorkflowSnapshot, node_index: usize) -> Option<String> {
    let node = &snapshot.nodes[node_index];

    match node.kind {
        WorkflowNodeKind::TextInput => node
            .data
            .content
            .as_deref()
            .filter(|content| !content.trim().is_empty())
            .map(|content| content.to_string()),
        WorkflowNodeKind::ImageInput => node
            .data
            .result_path
            .as_deref()
            .or(node.data.image_path.as_deref())
            .filter(|image| reusable_image_source(image))
            .map(|image| image.to_string()),
        WorkflowNodeKind::ImageGeneration
        | WorkflowNodeKind::TextToImage
        | WorkflowNodeKind::ImageToImage => node
            .data
            .result_url
            .as_deref()
            .or(node.data.result_path.as_deref())
            .filter(|image| reusable_image_source(image))
            .map(|image| image.to_string()),
        WorkflowNodeKind::Output => node
            .data
            .last_output_path
            .as_deref()
            .filter(|image| reusable_image_source(image))
            .map(|image| image.to_string()),
        WorkflowNodeKind::Group => Some("group".to_string()),
    }
}

fn reusable_image_source(image: &str) -> bool {
    let image = image.trim();
    if image.is_empty() {
        return false;
    }
    if is_remote_url(image) || image.starts_with("data:image/") {
        return true;
    }

    Path::new(image).is_file()
}

fn node_metrics(
    snapshot: &WorkflowSnapshot,
    node_index: usize,
    provider: &ProviderConfig,
    queued_at: Option<String>,
    started_at: Option<String>,
    finished_at: Option<String>,
    duration_ms: Option<u128>,
) -> RunNodeMetrics {
    let node = &snapshot.nodes[node_index];
    let provider_name = Some(provider.name.clone());

    RunNodeMetrics {
        queued_at,
        started_at,
        finished_at,
        duration_ms,
        provider_id: Some(provider.id.clone()),
        provider_name,
        model: node.data.model.clone(),
        retry_count: Some(0),
    }
}

fn upstream_failure(
    snapshot: &WorkflowSnapshot,
    node_id: &str,
    failed_nodes: &HashSet<String>,
) -> Option<String> {
    failed_nodes
        .iter()
        .find(|failed_node_id| has_path(snapshot, failed_node_id, node_id))
        .cloned()
}

fn has_path(snapshot: &WorkflowSnapshot, source_id: &str, target_id: &str) -> bool {
    let mut stack = vec![source_id.to_string()];
    let mut visited = HashSet::new();

    while let Some(node_id) = stack.pop() {
        if !visited.insert(node_id.clone()) {
            continue;
        }
        for edge in snapshot.edges.iter().filter(|edge| edge.source == node_id) {
            if edge.target == target_id {
                return true;
            }
            stack.push(edge.target.clone());
        }
    }

    false
}

fn run_summary(snapshot: &WorkflowSnapshot, execution_order: &[String]) -> RunSummary {
    let mut summary = RunSummary {
        total: execution_order.len(),
        ..RunSummary::default()
    };

    for node_id in execution_order {
        let status = snapshot
            .nodes
            .iter()
            .find(|node| node.id == *node_id)
            .map(|node| node.data.status.as_str())
            .unwrap_or("idle");
        match status {
            "success" => summary.success += 1,
            "error" => summary.error += 1,
            "blocked" => summary.blocked += 1,
            _ => summary.skipped += 1,
        }
    }

    summary
}

fn classify_error(error: &str) -> &str {
    if error.contains("供应商") || error.contains("模型") || error.contains("API Key") {
        "providerConfig"
    } else if error.contains("文件")
        || error.contains("目录")
        || error.contains("路径")
        || error.contains("不存在")
    {
        "fileSystem"
    } else if error.contains("网络") || error.contains("请求") || error.contains("HTTP") {
        "network"
    } else {
        "validation"
    }
}
