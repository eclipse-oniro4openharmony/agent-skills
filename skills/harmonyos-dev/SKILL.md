---
name: harmonyos-dev
description: Scaffold a new OpenHarmony / HarmonyOS app (Standard ArkTS or Native C++) and verify it builds. Cross-platform (Linux / macOS / Windows). For the inner dev loop on an existing project use `ohos-app-dev`; for system/persistent bundles use `ohos-system-dev`.
---

# HarmonyOS Development Skill (Project Scaffolding)

Scaffold a new app and confirm it builds. **Cross-platform** — no PowerShell-only commands.
Prefer the **`oniro-app` CLI** for scaffolding and build verification: it is cross-platform,
non-interactive (explicit flags, stdout/stderr split, exit codes), and owns the canonical
templates.

> **Prereqs:** `oniro-app` on PATH (`npm i -g @oniroproject/oniro-app`), plus an SDK +
> command-line tools (`oniro-app sdk install <ver>`, `oniro-app cmdtools install`).

## Directives

- **Single purpose:** scaffolding + initial build verification. Ongoing inner-loop work →
  `ohos-app-dev`; system/persistent bundles → `ohos-system-dev`.
- **Cross-platform shell — do NOT assume PowerShell.** Use the agent's file tools or
  OS-appropriate commands: `mkdir -p` / `cp -r` / `[ -e <path> ]` on macOS/Linux;
  `New-Item -ItemType Directory -Force` / `Copy-Item -Recurse` / `Test-Path` on Windows.
  Better: let `oniro-app` (cross-platform) do the scaffolding and build so you avoid
  hand-rolled copies entirely.
- **Lint before commit.** After editing `.ets` / `.ts`, run `oniro-app lint --files <globs>`.

## Scaffold

### Standard ArkTS (preferred) — via the CLI
Non-interactive and cross-platform:
```
oniro-app create --name <AppName> --bundle <com.example.app> --location <parent-dir> --sdk <api>
```
`oniro-app templates list` shows the available templates; `--sdk` is the API level
(e.g. `23` for 6.1 — see the table below). This replaces the old `xcopy`/`New-Item`
template-copy flow.

### Native C++ (ArkTS + Native API)
If the CLI templates don't include a Native C++ variant, use the template bundled with this
skill: copy `assets/nativec-template/` into the target directory with a **cross-platform**
recursive copy (agent file tools, or `cp -r` on macOS/Linux / `Copy-Item -Recurse` on
Windows), then run `ohpm install`. (`assets/harmonyos-project-template/` is the Standard
ArkTS equivalent if you'd rather copy than use `oniro-app create`.)

## Verify the build
```
oniro-app build          # auto-runs `ohpm install --all` if oh_modules/ is missing, then assembleHap
```
Resolve any errors before proceeding. Read `build-profile.json5` and cross-check
`compatibleSdkVersion` / `targetSdkVersion` against the API-level table. (The optional
`scripts/check_env.cjs` sanity-checks that `ohpm` / `hvigorw` / `codelinter` are on PATH.)

## After scaffolding
- On a successful build: `git init && git add -A && git commit -m "Initial commit from HarmonyOS template"`.
- Hand off to **`ohos-app-dev`** for the build → deploy → run → logs → UI loop, or
  **`conductor-dev`** to add Conductor-based orchestration.

## Resources
- Standard ArkTS template: `assets/harmonyos-project-template/`
- Native C++ template: `assets/nativec-template/`
- Env check: `scripts/check_env.cjs`

## Reference: Version → API Level

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

**Note:** If the version string in `build-profile.json5` includes a number in parentheses
(e.g. `6.0.0(20)`), the parenthesised number **is** the API level.
