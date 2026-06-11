# Repository Guidelines

## Project Structure & Module Organization

This repository is a Tauri 2 desktop app with a React 19 and Vite frontend.

- `src/` contains the TypeScript React UI. `src/main.tsx` mounts the app, `src/App.tsx` holds the starter UI, and `src/assets/` stores imported frontend assets.
- `public/` stores static files served by Vite, such as `vite.svg` and `tauri.svg`.
- `src-tauri/` contains the Rust/Tauri shell. `src-tauri/src/lib.rs` defines Tauri commands, `src-tauri/src/main.rs` starts the app, and `src-tauri/tauri.conf.json` configures the desktop bundle.
- Root config files include `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, and `package.json`.

## Build, Test, and Development Commands

- `npm install`: install JavaScript and Tauri CLI dependencies from `package-lock.json`.
- `npm run dev`: start the Vite development server for the React frontend.
- `npm run build`: run TypeScript checks with `tsc`, then create a production Vite build.
- `npm run preview`: preview the production frontend build locally.
- `npm run tauri dev`: launch the full Tauri desktop app in development mode.
- `npm run tauri build`: build the distributable Tauri application.
- `cd src-tauri && cargo check`: type-check the Rust side without producing a release bundle.

Whenever you need to debug and inspect the frontend web interface, please visit http://localhost:1420/. Do not attempt to start the project yourself; if the address is inaccessible, you may prompt me to start the entire program before trying to access it again.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and ES modules in the frontend. Follow the existing style: two-space indentation, double quotes, semicolons, and PascalCase component names such as `App`. Keep component-specific styles in nearby CSS files like `src/App.css`.

Use Rust 2021 conventions in `src-tauri/`: snake_case functions, clear command names, and `cargo fmt` formatting. Tauri commands exposed to the frontend should have stable names, for example `invoke("greet", { name })`.

## Testing Guidelines

No test framework is currently configured. Before submitting changes, run `npm run build` and `cd src-tauri && cargo check`. If tests are added later, place frontend tests beside the relevant component or under `src/__tests__/`, and add Rust unit tests in the module they cover.

## Commit & Pull Request Guidelines

The existing history uses a short Conventional Commit style, for example `feat:init`. Prefer `feat:`, `fix:`, `docs:`, `refactor:`, or `chore:` followed by a concise imperative summary.

Pull requests should include a brief description, linked issue when applicable, test/build commands run, and screenshots or recordings for visible UI changes. Note any Tauri permission or configuration changes explicitly.

## Security & Configuration Tips

Review `src-tauri/capabilities/default.json` and `src-tauri/tauri.conf.json` when adding native APIs. Keep permissions narrow, avoid committing secrets, and document required environment variables in `README.md`.
