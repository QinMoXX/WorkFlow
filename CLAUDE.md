# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Dev Commands

```bash
npm install                  # Install JS + Tauri CLI deps
npm run dev                  # Vite dev server (port 1420)
npm run build                # tsc + vite build
npm run tauri dev             # Full Tauri desktop app (dev mode)
npm run tauri build           # Production desktop bundle
cd src-tauri && cargo check   # Type-check Rust side only
```

No test framework is configured. Pre-commit verification: `npm run build && cd src-tauri && cargo check`.

## Architecture

This is a **Tauri 2 desktop app** for node-based AI image workflows — drag nodes onto a canvas, wire them together, and run AI image generation pipelines.

**Stack:** React 19 + TypeScript + Vite (frontend) | Rust 2021 + Tauri 2 (backend) | @xyflow/react (canvas)

### Data Flow

```
User canvas edits → React Flow state (nodes/edges)
  → on run: toSnapshot() serializes → invoke("run_node"|"run_workflow")
  → Rust: validate_connections → topological_order → execute each node
  → Real-time events emitted: workflow://run/started|node|log|finished
  → Frontend subscribes via listen() from @tauri-apps/api/event
  → Final RunResponse returned for consistency
```

### Frontend (src/)

All application state and logic lives in **`src/hooks/useWorkflowApp.ts`** (~1200 lines) — the single "god hook" that manages nodes, edges, selection, menus, clipboard, undo/redo, run orchestration, and keyboard shortcuts. `App.tsx` is thin markup wiring this hook to React Flow and UI components.

| File | Role |
|---|---|
| `src/types/workflow.ts` | TS types matching Rust models (camelCase, shared JSON contract) |
| `src/types/provider.ts` | Provider/Model config types |
| `src/lib/workflowGraph.ts` | Connection rules (`connectionRules`), `toSnapshot`/`fromSnapshot` serialization, `resolveConnectionRule` for port mapping |
| `src/lib/nodeCatalog.ts` | `createNode()` factory, default initial nodes/edges |
| `src/lib/providerPresets.ts` | Default OpenAI + Agnes AI provider templates |
| `src/data/mockData.ts` | All UI copy strings, node templates, menu action definitions |
| `src/components/WorkflowNodeCard.tsx` | Single node card rendered on canvas (Handles, status badge, preview) |
| `src/components/NodeSettingsPopover.tsx` | Floating settings panel positioned below selected node via `ViewportPortal` |
| `src/components/AiSettingsPanel.tsx` | Provider CRUD panel |
| `src/components/WorkspaceSidebar.tsx` | Left sidebar (node library + run/save actions) |

### Backend (src-tauri/src/)

| File | Role |
|---|---|
| `src-tauri/src/lib.rs` | Tauri app setup, command registration, plugin init |
| `src-tauri/src/workflow/commands.rs` | Tauri command implementations (invoke targets), `RunControlState` for cancellation |
| `src-tauri/src/workflow/executor.rs` | `run_nodes()` — the execution engine: iterates nodes in topological order, calls `execute_node()`, emits events, handles cancellation and upstream failures |
| `src-tauri/src/workflow/graph.rs` | `topological_order()` (Kahn's algorithm), `validate_connections()`, `execution_order_for_node()` (transitive upstream closure) |
| `src-tauri/src/workflow/image_provider.rs` | `OpenAiCompatibleImageProvider` — builds HTTP client with proxy/fallback DNS, calls `/images/generations`, downloads or decodes base64 results |
| `src-tauri/src/workflow/providers.rs` | Provider config CRUD (`save`/`load` to `appData/providers/config.json`), `resolve_ai_node_provider()` validation |
| `src-tauri/src/workflow/storage.rs` | File I/O: workflow snapshots, imported/generated/thumbnail asset directories, `show_path_in_folder` (platform-specific) |
| `src-tauri/src/workflow/models.rs` | Rust serde types for all data structures (camelCase, mirrors frontend types) |

### Node Types & Connection Rules

Six node kinds: `textInput`, `imageInput`, `textToImage`, `imageToImage`, `output`, `group` (visual grouping only, no execution semantics).

Connection rules are **defined in both** `src/lib/workflowGraph.ts` (frontend validation) **and** `src-tauri/src/workflow/graph.rs` (backend validation). They must stay in sync:

- `textInput(text-out)` → `textToImage|imageToImage(prompt-in)` [text]
- `imageInput|textToImage|imageToImage(image-out)` → `imageToImage|output(image-in)` [image]

`resolveConnectionRule()` in the frontend maps unified port IDs (each node now has one left port and one right port) to the correct semantic handle.

### Events Protocol

Backend emits structured events during execution (see `docs/run-event-protocol.md`):
- `workflow://run/started` — marks involved nodes as `queued`
- `workflow://run/node` — per-node state transitions (queued→running→success/error/blocked)
- `workflow://run/log` — structured log entries
- `workflow://run/finished` — final summary

Frontend filters by `runId` and `sequence` to handle stale/out-of-order events.

### Data Persistence

- `appData/workflows/current.json` — single workflow snapshot (nodes + edges, no binary)
- `appData/providers/config.json` — provider configs including **plaintext API keys**
- `appData/assets/imported/` — local images
- `appData/assets/generated/` — AI-generated images
- `appData/assets/thumbnails/` — import thumbnails

Undo/redo uses an in-memory snapshot stack (60 entries max). Workspace viewport is persisted to `localStorage`.

### Key Conventions

- JSON fields use `camelCase` everywhere (TS and Rust via `#[serde(rename_all = "camelCase")]`)
- All node types share a single `WorkflowNodeData` struct; different node kinds use different field subsets
- `toPersistableSnapshot()` strips runtime state (error, status) before saving
- CSP is `null` in tauri.conf.json; `$APPDATA/**` assets are served via Tauri asset protocol
- Dev server fixed at port 1420; strict port enforcement
- Two-space indentation, double quotes, semicolons (frontend); `cargo fmt` (Rust)
- Commit style: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:` prefix + imperative summary

### When Adding/Changing Data Fields

Update in order (see `docs/workflow-json-schema.md`):
1. TS types in `src/types/`
2. Rust models in `src-tauri/src/workflow/models.rs`
3. Snapshot conversion in `src/lib/workflowGraph.ts`
4. Backend validation/executor/storage as needed
5. Run `npm run build && cd src-tauri && cargo check`
