---
name: ohos-app-scaffold
description: Scaffold a new OpenHarmony / HarmonyOS app (Standard ArkTS, Native C++, or HarmonyOS) with the cross-platform `oniro-app` CLI and verify it builds and its tests pass. For the inner dev loop on an existing project use `ohos-app-dev`; for system/persistent bundles use `ohos-system-dev`.
---

# OHOS App Scaffold

Create a new app from a template, confirm it builds, then hand off. Everything goes through
the **`oniro-app` CLI**: cross-platform (Linux / macOS / Windows), non-interactive (explicit
flags, stdout=results / stderr=logs, non-zero exit on failure), and the owner of the canonical
project templates — so you never hand-roll a `cp` / `xcopy` template copy.

> **Prereqs:** `oniro-app` on PATH (`npm i -g @oniroproject/oniro-app`), plus an installed SDK
> and command-line tools (`oniro-app sdk install <ver>`, `oniro-app cmdtools install`).
> `oniro-app sdk list` / `oniro-app cmdtools status` confirm what's installed.

## Scaffold

`oniro-app templates list` shows the available templates. Scaffolding is one non-interactive,
cross-platform command:

```
oniro-app create --name <AppName> --bundle <com.example.app> --location <parent-dir> --sdk <api> [--template <id>]
```

| Template | Use when |
| --- | --- |
| `EmptyAbility` (default) | An ArkTS / ArkUI app for OpenHarmony or Oniro: almost every app. |
| `NativeCpp` | The app needs C or C++ (a library, performance-critical code): ArkUI plus a CMake-built `libentry.so` called through Node-API. |
| `HarmonyOSApp` | The app must run on HarmonyOS devices. It builds against the HarmonyOS SDK (DevEco Studio or the HarmonyOS command-line tools) and is signed with `oniro-app sign --harmonyos`, which needs a Huawei developer account. |

Every template has an `ohosTest` module (`entry/src/ohosTest`) with a unit suite and a UI
suite that exercise the template's own page; keep it, and add a suite per feature.

`--sdk` is the numeric API level (run `oniro-app sdk list` for the version↔API mapping).
Pick the API of the device or emulator the app must run on, or lower: an app whose
`compatibleSdkVersion` is above the device's API does not install (`oniro-app devices
--long` shows the device's API), and newer APIs are only in newer SDKs.
`oniro-app sdk list` shows which are installed.
`--module <name>` renames the default `entry` module. `oniro-app create` writes the bundle
name, app name, and SDK version into the scaffold for you.

## Verify the build

```
oniro-app doctor         # SDK for the project, tools, device, signing: fix what fails
oniro-app sign           # local signing material (`sign --harmonyos` for HarmonyOSApp)
oniro-app build          # auto-runs `ohpm install --all` if oh_modules/ is missing, then assembleHap
oniro-app test           # builds the ohosTest HAP, installs both, runs the suites on the device
```
Resolve any errors before proceeding: `build --json` lists each one with file, line and
code (see `ohos-app-dev/references/troubleshooting.md`). A fresh scaffold passes `test`;
if it does not, the environment is wrong, not the app. If
`build-profile.json5` shows the API level in parentheses (e.g. `6.0.0(20)`), that number **is**
the API level; `oniro-app sdk list` maps versions to API levels.

## After scaffolding

- On a successful build: `git init && git add -A && git commit -m "Initial commit"`.
- Hand off to **`ohos-app-dev`** for the inner loop (check → build → deploy → run → test →
  logs → UI), or **`conductor-dev`** for a single-agent, human-in-the-loop Conductor workflow.
- ArkTS strict-mode rules and app architecture guidance live in **`ohos-app-dev`**
  (`references/arkts-strict.md`, `references/architecture.md`).

## Out of scope

- Inner-loop work on an existing project → `ohos-app-dev`.
- System / persistent bundles (systemui, launcher, OHOS source-tree builds) → `ohos-system-dev`.
