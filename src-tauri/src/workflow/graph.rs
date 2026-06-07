use std::collections::{HashMap, HashSet, VecDeque};

use super::models::{WorkflowDataType, WorkflowNode, WorkflowNodeKind, WorkflowSnapshot};

pub fn validate_connections(snapshot: &WorkflowSnapshot) -> Result<(), String> {
    let nodes = node_map(snapshot);

    for edge in &snapshot.edges {
        let source = nodes
            .get(&edge.source)
            .ok_or_else(|| format!("连线 {} 的源节点不存在", edge.id))?;
        let target = nodes
            .get(&edge.target)
            .ok_or_else(|| format!("连线 {} 的目标节点不存在", edge.id))?;

        let source_type =
            output_type(&source.kind).ok_or_else(|| format!("节点 {} 没有输出端口", source.id))?;
        let target_type = input_type(edge.target_handle.as_deref())
            .ok_or_else(|| format!("节点 {} 的输入端口无效", target.id))?;

        if source_type != edge.data_type || target_type != edge.data_type {
            return Err(format!("连线 {} 类型不匹配", edge.id));
        }
    }

    Ok(())
}

pub fn topological_order(snapshot: &WorkflowSnapshot) -> Result<Vec<String>, String> {
    let node_ids: HashSet<String> = snapshot.nodes.iter().map(|node| node.id.clone()).collect();
    let mut incoming_count: HashMap<String, usize> = node_ids
        .iter()
        .map(|node_id| (node_id.clone(), 0usize))
        .collect();
    let mut outgoing: HashMap<String, Vec<String>> = HashMap::new();

    for edge in &snapshot.edges {
        *incoming_count.entry(edge.target.clone()).or_default() += 1;
        outgoing
            .entry(edge.source.clone())
            .or_default()
            .push(edge.target.clone());
    }

    let mut ready: VecDeque<String> = incoming_count
        .iter()
        .filter_map(|(node_id, count)| (*count == 0).then_some(node_id.clone()))
        .collect();
    let mut order = Vec::new();

    while let Some(node_id) = ready.pop_front() {
        order.push(node_id.clone());
        if let Some(targets) = outgoing.get(&node_id) {
            for target in targets {
                let count = incoming_count
                    .get_mut(target)
                    .ok_or_else(|| format!("节点 {} 不存在", target))?;
                *count -= 1;
                if *count == 0 {
                    ready.push_back(target.clone());
                }
            }
        }
    }

    if order.len() != node_ids.len() {
        return Err("工作流存在环，无法运行".to_string());
    }

    Ok(order)
}

pub fn execution_order_for_node(
    snapshot: &WorkflowSnapshot,
    node_id: &str,
) -> Result<Vec<String>, String> {
    if !snapshot.nodes.iter().any(|node| node.id == node_id) {
        return Err(format!("节点 {} 不存在", node_id));
    }

    let mut required = HashSet::from([node_id.to_string()]);
    let mut changed = true;

    while changed {
        changed = false;
        for edge in &snapshot.edges {
            if required.contains(&edge.target) && required.insert(edge.source.clone()) {
                changed = true;
            }
        }
    }

    Ok(topological_order(snapshot)?
        .into_iter()
        .filter(|id| required.contains(id))
        .collect())
}

fn output_type(kind: &WorkflowNodeKind) -> Option<WorkflowDataType> {
    match kind {
        WorkflowNodeKind::TextInput => Some(WorkflowDataType::Text),
        WorkflowNodeKind::ImageInput
        | WorkflowNodeKind::TextToImage
        | WorkflowNodeKind::ImageToImage => Some(WorkflowDataType::Image),
        WorkflowNodeKind::Output => None,
    }
}

fn input_type(handle_id: Option<&str>) -> Option<WorkflowDataType> {
    match handle_id {
        Some("prompt-in") => Some(WorkflowDataType::Text),
        Some("image-in") => Some(WorkflowDataType::Image),
        _ => None,
    }
}

fn node_map(snapshot: &WorkflowSnapshot) -> HashMap<String, &WorkflowNode> {
    snapshot
        .nodes
        .iter()
        .map(|node| (node.id.clone(), node))
        .collect()
}
