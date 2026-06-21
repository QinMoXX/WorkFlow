use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowNodeKind {
    TextInput,
    ImageInput,
    ImageGeneration,
    TextToImage,
    ImageToImage,
    Output,
    Group,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeData {
    pub kind: WorkflowNodeKind,
    pub title: String,
    pub status: String,
    pub content: Option<String>,
    pub image_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub prompt_override: Option<String>,
    pub negative_prompt: Option<String>,
    pub aspect_ratio: Option<String>,
    pub style_preset: Option<String>,
    pub seed: Option<String>,
    pub strength: Option<f64>,
    pub save_directory: Option<String>,
    pub last_output_path: Option<String>,
    pub result_path: Option<String>,
    pub result_url: Option<String>,
    pub progress: Option<u8>,
    pub error: Option<String>,
    pub group_width: Option<f64>,
    pub group_height: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNode {
    pub id: String,
    pub kind: WorkflowNodeKind,
    pub position: Position,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub extent: Option<String>,
    pub data: WorkflowNodeData,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowDataType {
    Text,
    Image,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
    pub data_type: WorkflowDataType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowSnapshot {
    pub nodes: Vec<WorkflowNode>,
    pub edges: Vec<WorkflowEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowCanvas {
    pub id: String,
    pub name: String,
    pub asset_dir_name: String,
    pub snapshot: WorkflowSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowProject {
    pub active_canvas_id: String,
    #[serde(default)]
    pub asset_root_dir: Option<String>,
    pub canvases: Vec<WorkflowCanvas>,
}

#[derive(Debug, Serialize)]
pub struct RunResponse {
    pub snapshot: WorkflowSnapshot,
    pub logs: Vec<String>,
    #[serde(rename = "runId")]
    pub run_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedImage {
    pub image_path: String,
    pub thumbnail_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunStartedEvent {
    pub run_id: String,
    pub mode: String,
    pub target_node_id: Option<String>,
    pub node_ids: Vec<String>,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunNodeEvent {
    pub run_id: String,
    pub node_id: String,
    pub status: String,
    pub sequence: u64,
    pub timestamp: String,
    pub node: RunNodeSnapshot,
    pub output: Option<RunNodeOutput>,
    pub error: Option<RunError>,
    pub metrics: Option<RunNodeMetrics>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunNodeSnapshot {
    pub id: String,
    pub title: String,
    pub kind: WorkflowNodeKind,
    pub status: String,
    pub result_path: Option<String>,
    pub result_url: Option<String>,
    pub last_output_path: Option<String>,
    pub progress: Option<u8>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunNodeOutput {
    pub data_type: Option<WorkflowDataType>,
    pub local_path: Option<String>,
    pub remote_url: Option<String>,
    pub thumbnail_path: Option<String>,
    pub text_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunNodeMetrics {
    pub queued_at: Option<String>,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub duration_ms: Option<u128>,
    pub provider_id: Option<String>,
    pub provider_name: Option<String>,
    pub model: Option<String>,
    pub retry_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunLogEvent {
    pub run_id: String,
    pub sequence: u64,
    pub timestamp: String,
    pub level: String,
    pub message: String,
    pub node_id: Option<String>,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunFinishedEvent {
    pub run_id: String,
    pub status: String,
    pub started_at: String,
    pub finished_at: String,
    pub duration_ms: u128,
    pub summary: RunSummary,
    pub error: Option<RunError>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RunSummary {
    pub total: usize,
    pub success: usize,
    pub error: usize,
    pub blocked: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunError {
    pub kind: String,
    pub code: String,
    pub message: String,
    pub node_id: Option<String>,
    pub cause_node_id: Option<String>,
    pub retryable: bool,
}
