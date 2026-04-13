---
name: ohos-app-dev
description: Develop, build, deploy, and validate OpenHarmony / HarmonyOS applications on a connected device. Use for the inner dev loop (lint → build → deploy → run → inspect logs → UI validation) on an existing project. For project scaffolding use `harmonyos-dev` instead.
---

# OpenHarmony App Dev

Inner-loop skill for working on an **existing** OpenHarmony / HarmonyOS app. All toolchain and device actions are performed through two MCP servers — never shell out to `ohpm`, `hvigorw`, `codelinter`, or `hdc` directly when an MCP tool exists for the operation.

- **`ohos-app`** — toolchain: `ohpm`, `codelinter`, `hvigorw`, HAP packaging, deploy.
- **`ohos-hdc`** — device runtime: shell, input, logs, screenshots, app lifecycle, file transfer.

## When to use this skill

Trigger on requests like: "build the app", "deploy to the device", "run it on device", "lint these files", "grab the logs", "take a screenshot", "tap this button", "why is it crashing on launch", "install the latest HAP". If the user wants to *create* a new project, hand off to `harmonyos-dev`.

## Directives

1. **MCP-first.** Prefer `mcp__ohos-app__*` / `mcp__ohos-hdc__*` tools over Bash. They handle signing, `hvigorw`, device-serial selection, and output parsing. Drop to `shell(...)` on the hdc MCP only for device-side commands that have no dedicated tool.
2. **Project path resolution.** The MCP servers respect `OHOS_PROJECT_PATH` from their env. Only pass `project_path` explicitly when operating on a project other than the configured default, or when the working directory is ambiguous.
3. **Lint before you iterate.** After editing any `.ets` / `.ts` / `.cpp` / `.h` file, run `codelinter` on the changed files before building. Resolve errors; justify warnings.
4. **Install dependencies only when needed.** `build_hap` auto-runs `ohpm install --all` if `oh_modules/` is missing. Don't call `ohpm_install` pre-emptively — call it when a dependency in `oh-package.json5` changed or the build complains about missing modules.
5. **Device serial.** If `list_devices` returns more than one target, ask the user which to use (or expect `DEVICE_SERIAL` in env). Never silently pick one.
6. **No destructive device ops without confirmation.** `uninstall_app`, wiping `/data/...`, overwriting device files via `send_file` to system paths — confirm first.
7. **UI coordinates are native pixels** and are 1:1 with `screenshot()` output. When computing tap targets from a screenshot, use the raw pixel coordinates — don't rescale.

## Inner-loop workflow

The canonical edit → verify → deploy → inspect cycle:

1. **Edit** source files (via `Edit` / `Write`).
2. **Lint** — `mcp__ohos-app__codelinter` on the changed files (pass them via `args`).
3. **Build** — `mcp__ohos-app__build_hap` (default mode; use `tasks` only for non-standard targets like `assembleHsp`).
4. **Confirm device** — `mcp__ohos-hdc__list_devices`. If empty, stop and tell the user.
5. **Deploy** — `mcp__ohos-app__deploy` with `replace: true` for iterative installs. It picks the most recent signed HAP automatically.
6. **Launch** — `mcp__ohos-hdc__start_app` with `bundle_name` and `ability_name` from the project's `app.json5` / `module.json5`.
7. **Observe**:
   - `mcp__ohos-hdc__get_logs` — filter by `bundle_name` to cut noise; bump `lines` when chasing a crash.
   - `mcp__ohos-hdc__screenshot` — returns a JPEG you can read directly. Use this to verify UI state, not to "prove completion".
   - `mcp__ohos-hdc__send_input` — drive the app for smoke tests (`click`, `swipe`, `inputText`, `keyEvent`).
8. **Stop / clean up** when done — `mcp__ohos-hdc__stop_app`, or `mcp__ohos-app__clean` if build artifacts are suspect.

## Recipes

### Quick rebuild & reinstall
Use after code edits when dependencies are unchanged:
- `codelinter(args: ["<changed-files>"])`
- `build_hap()`
- `deploy(replace: true)`
- `stop_app(bundle_name)` → `start_app(bundle_name, ability_name)`

### Diagnosing a runtime crash
- `start_app(...)` to reproduce.
- `get_logs(bundle_name, lines: 500)` — look for `E` level and `SIGSEGV` / `FATAL`.
- If native: `get_device_info()` for OS version, then inspect the crash fault log via `shell("ls /data/log/faultlog/faultlogger")` and `recv_file` the relevant entry.

### UI validation against a design
- `screenshot()` → compare to reference. Read `build-profile.json5` first to know the target API level (see mapping below), since some components render differently across API levels.
- Record discrepancies as plain notes in the user's reply — don't spawn a journal file unless asked.

### Dependency change
- Edit `oh-package.json5`.
- `ohpm_install()`.
- `build_hap()`.

### Clean rebuild
- `clean()` → `ohpm_install()` → `build_hap()`. Reach for this when builds fail with stale-cache symptoms (missing generated types, unresolved imports that clearly exist).

## SDK / API level reference

Read `build-profile.json5` to get `compatibleSdkVersion` / `targetSdkVersion`. If the version string embeds the API level in parentheses (e.g. `6.0.0(20)`), the parenthesised number **is** the API level. Otherwise use:

| Version | API Level |
| :--- | :--- |
| 4.0 | 10 |
| 4.1 | 11 |
| 5.0.0 | 12 |
| 5.0.1 | 13 |
| 5.0.2 | 14 |
| 5.0.3 | 15 |
| 5.1.0 | 18 |
| 5.1.1 | 19 |
| 6.0 | 20 |
| 6.1 | 23 |

## Out of scope

- Project scaffolding / template copy / `git init` of a fresh repo → use `harmonyos-dev`.
