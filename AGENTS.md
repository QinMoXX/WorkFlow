# Repository Guidelines

## Project Structure & Module Organization

This is a Tauri 2 desktop workflow app with a React 19, Vite, TypeScript, and Tailwind frontend.

- `src/` contains the React UI. `src/main.tsx` mounts the app, `src/App.tsx` composes the workspace, `src/components/` holds reusable UI, and `src/lib/` contains workflow/catalog logic.
- `src/types/` defines shared TypeScript types, and `src/data/` holds UI mock data.
- `public/` stores static files served by Vite. `docs/` contains architecture, protocol, design, and reference-image material.
- `src-tauri/` contains the Rust/Tauri shell. `src-tauri/src/lib.rs` wires the app, `src-tauri/src/workflow/` implements commands and execution, and `tauri.conf.json` configures the bundle.
- Root config files include `vite.config.ts`, `tsconfig*.json`, and `package.json`.

## Build, Test, and Development Commands

- `npm install`: install JavaScript and Tauri CLI dependencies from `package-lock.json`.
- `npm run dev`: start the Vite frontend. For web UI debugging, use `http://localhost:1420/`; ask the user to start the app if unavailable.
- `npm run build`: run TypeScript checks with `tsc`, then create a production Vite build.
- `npm run preview`: preview the production frontend build locally.
- `npm run tauri dev`: launch the full Tauri desktop app.
- `npm run tauri build`: build the distributable app.
- `cd src-tauri && cargo check`: type-check Rust without producing a bundle.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and ES modules in the frontend. Follow the existing style: two-space indentation, double quotes, semicolons, and PascalCase component names. Keep component styles nearby, for example `src/App.css`.

Use Rust 2021 conventions in `src-tauri/`: snake_case functions, command names, and `cargo fmt`. Frontend-facing Tauri commands should have stable names, for example `invoke("greet", { name })`.

## Testing Guidelines

No test framework is currently configured. Before submitting changes, run `npm run build` and `cd src-tauri && cargo check`. If tests are added later, place frontend tests beside the component or under `src/__tests__/`, and Rust unit tests in the module they cover.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, often in Chinese. Keep subjects concise and action-oriented. Conventional prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, or `chore:` are welcome when they clarify scope.

Pull requests should include a brief description, linked issue when applicable, test/build commands run, and screenshots for visible UI changes. Note Tauri permission or configuration changes explicitly.

## Security & Configuration Tips

Review `src-tauri/capabilities/default.json` and `src-tauri/tauri.conf.json` when adding native APIs. Keep permissions narrow, avoid committing secrets, and document required environment variables in `README.md`.
