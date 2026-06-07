use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WorkflowNodeKind {
    TextInput,
    ImageInput,
    TextToImage,
    ImageToImage,
    Output,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNodeData {
    pub kind: WorkflowNodeKind,
    pub title: String,
    pub status: String,
    pub content: Option<String>,
    pub image_path: Option<String>,
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
    pub error: Option<String>,
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
    pub data: WorkflowNodeData,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Serialize)]
pub struct RunResponse {
    pub snapshot: WorkflowSnapshot,
    pub logs: Vec<String>,
}
