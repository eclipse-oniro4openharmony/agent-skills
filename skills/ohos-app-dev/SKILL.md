---
name: ohos-app-dev
description: Develop, build, deploy, test, and validate OpenHarmony / HarmonyOS applications on a connected device. Use for the inner dev loop (check → build → deploy → run → test → inspect logs → UI validation) on an existing project, e.g. "build the app", "run it on the device", "check these files", "run the tests", "why does it crash on launch", "tap this button", "take a screenshot". For project scaffolding use `ohos-app-scaffold`; for system/persistent bundles use `ohos-system-dev`.
metadata:
  oniro-app-version: "0.18.0"
---

# OpenHarmony App Dev

Inner-loop skill for working on an **existing** OpenHarmony / HarmonyOS app. Every
toolchain and device action goes through the **`oniro-app` CLI**, an agent-designed wrapper
over `hvigorw`, `ohpm`, the SDK's ArkTS checker, `hdc`, `aa test` and `uitest`: explicit
flags, results on **stdout**, progress on **stderr**, non-zero exit on failure. Drop to raw
`hdc` / `aa` / `bm` only for device operations `oniro-app` does not cover.

> **Prereqs:** `oniro-app` on PATH (`npm i -g @oniroproject/oniro-app`, validated against
> the version in this skill's `metadata`), an SDK and the command-line tools. `oniro-app
> doctor` checks all of it (SDK for the project, tools, device, signing) and names the fix.

## When to use

Trigger on: "build the app", "deploy / run it on the device", "check / lint these files",
"fix the build errors", "run the tests", "grab the logs", "why is it crashing", "take a
screenshot", "tap this button", "does this screen match the design". For *creating* a
project → `ohos-app-scaffold`. For **system / persistent bundles** (systemui, launcher,
OS-source-tree builds, reboot-to-reload) → `ohos-system-dev`.

## Sandbox rule

Some commands leave the machine or change the device. In a session that gates them
(`permissionMode: acceptEdits`, a CI sandbox), expect a prompt or a refusal for these, and
batch them rather than retrying:

- **Network:** `sdk install`, `cmdtools install`, `emulator install`, `auth *`, `sign
  --harmonyos` (AppGallery Connect), `build` when `oh_modules/` is missing (ohpm).
- **Device state:** `app *` (install, apply, launch, stop, uninstall), `test` (installs two
  HAPs), `input`, `gesture`, `reboot`, `file send`, `emulator start|stop|remove`, `hdc`.

Read-only and local: `check arkts`, `lint`, `doctor` (without `--fix`), `devices`, `dump
layout`, `screenshot`, `wait`, `watch`, `logs`, `sdk list`, `cmdtools status`, `templates`.

## Directives

1. **CLI-first.** Use `oniro-app <cmd>` for build, deploy, device, logs, input and capture.
   It resolves the device serial, the bundle and main ability (`app.json5`,
   `module.json5`) and the built HAPs. When no command fits, use raw `hdc`/`aa`/`bm`.
2. **Check once per edit round, then build.** When a round of edits is done (not after
   every single edit), run `oniro-app check arkts --files <changed .ets files>`: the SDK's
   own ArkTS type check and linter plus the ArkUI rules the build enforces, in seconds and
   without a build. Fix every error, then `oniro-app build`. Exit 2 or `"completed": false`
   means the checker did not run, so you know nothing: never read it as a pass. `oniro-app
   lint` (codelinter) gives a full report only when the command-line tools are the project's
   flavour (`oniro-app doctor` says); treat its `"incomplete": true` or exit 2 the same way.
   The build's ArkTS compiler stays the final word, and it is the only gate when `oniro-app
   check --help` lists no `arkts` (oniro-app before 0.18).
3. **Device serial.** `oniro-app devices`. If more than one target, set
   `ONIRO_DEVICE_SERIAL` (or pass `--device <serial>`). Never silently pick one.
4. **Act on elements, not coordinates.** See what is on screen with `oniro-app dump layout
   --flat`, then act by label: `oniro-app input --type click --target "Sign in"`. When
   several elements match, it fails and lists them as `[i] …`: pick with `--target-index
   i`, or narrow with `--target-type Button` / `--target-id <id>`. With no label, pass the
   element's 0–1 center (`--fx 0.5 --fy 0.62`). Pixels (`--x/--y`) are a last resort.
   For an exact match use `--selector 'type=Button,text*=Sign'` or `--selector 'xpath=...'`
   ([`references/device-ui.md`](./references/device-ui.md)). The
   dump shows the **visible area only**: scroll and dump again before deciding an element
   is missing.
5. **Wait for the UI, don't sleep.** After an action that changes the screen, wait for the
   result: `oniro-app wait --target "<text>" --timeout 10000`, or `--gone` for a spinner or
   dialog to go. Acting on a stale layout hits the wrong element.
6. **Done means tested.** A feature is done when a test in `src/ohosTest` exercises it and
   `oniro-app test` passes (see Tests below), not when it builds.
7. **End with a report.** Finish every task with one fenced `json` block, the last thing
   you write, in this shape (fill in what you ran; `[]` or `null` when not applicable):
   ```json
   {
     "item": "screen:SettingsPage",
     "status": "done | partial | blocked",
     "filesChanged": ["entry/src/main/ets/pages/SettingsPage.ets"],
     "commands": [{ "cmd": "oniro-app check arkts --files ...", "exit": 0 }],
     "check": { "errors": 0, "warnings": 1 },
     "build": { "ok": true, "errors": 0 },
     "tests": { "run": 3, "pass": 3, "fail": 0, "error": 0 },
     "pagesRendered": ["SettingsPage"],
     "routesWired": ["Home->SettingsPage"],
     "evidence": ["/tmp/settings.jpg", "pid 4242"],
     "assumptions": ["Theme persisted with Preferences"],
     "unresolved": [],
     "confidence": 0.8
   }
   ```
   `check`, `build` and `tests` are the `summary` of `check arkts --json`, `build --json`
   and `test --json`. `confidence` (0–1) is your own judgement that the item meets its
   acceptance criteria.

## Inner-loop workflow

1. **Edit** sources.
2. **Check:** `oniro-app check arkts --files <changed files>`; fix every error. `--fix`
   applies the fixes it can verify (compiler suggestions, import paths, a missing `export`)
   and lists them in `fixed`.
3. **Build:** `oniro-app build` runs `ohpm install` when `oh_modules/` is missing, builds,
   and finds the HAPs (`--module`, `--product`, `--mode release`; `--no-deps` skips ohpm).
   `--json` prints one object either way; on failure `diagnostics` lists each error with
   `file`, `line`, `column`, `code` and `rule`. Before using an SDK API you are not sure of,
   `oniro-app api show <Class.member>` says whether this project's API level declares it
   (exit 1 if not); `oniro-app api search "<words>"` finds the right one. On a fresh clone with empty
   `signingConfigs`, run `oniro-app sign --bootstrap` first (needs `java`); its keys in
   `signatures/` are local dev material, never commit them.
4. **Device:** `oniro-app devices`; stop and tell the user if empty.
5. **Deploy:** `oniro-app app apply`, a verified install: it handles sign-info mismatch
   (uninstall and install for a normal app), asset-cache invalidation and persistent-bundle
   restart, and prints `method` and the pids before and after. `oniro-app app install` is a
   plain `hdc install`.
6. **Launch:** `oniro-app app launch` (`--ability <name>` / `--module <m>` to pick one).
   Add `--smoke` to judge the launch: exit 1 when the process died, a crash was recorded
   or the screen is blank, with the crash and a screenshot in `--json`.
7. **Observe:**
   - Logs: `oniro-app wait --log '<regex>' --timeout 30000` returns when a line matches;
     `oniro-app watch --log '<regex>' --for 5000` collects for a window.
   - Screen: `oniro-app screenshot --max-dim 1024 -o /tmp/s.jpg`, then read it. For detail,
     crop with `--target "<text>"` or `--crop x1,y1,x2,y2`; for animations,
     `--contact-sheet`.
   - Layout: `oniro-app dump layout --flat`, one line per element with 0–1 centers;
     `covered` means another layer is on top, so a tap there hits that layer. `--diff
     <saved.json>` compares with an earlier dump; `screenshot --diff <saved.jpeg>` likewise.
   - Pages and routes in the source: `oniro-app screens` (no device).
   - Drive: `oniro-app input --type click|swipe|inputText|keyEvent|hideKeyboard ...` and
     `oniro-app gesture`.

   Flags, output formats and the raw-device escape hatches are in
   [`references/device-ui.md`](./references/device-ui.md).
8. **Test:** `oniro-app test` (see Tests).
9. **Stop:** `oniro-app app stop <bundle>`.

## Recipes

### Quick rebuild & reinstall
`oniro-app check arkts --files <files>` → `oniro-app build` → `oniro-app app apply` →
`oniro-app app stop <bundle>` → `oniro-app app launch`.

### Diagnose a crash or freeze
`oniro-app app launch --smoke` reproduces and judges the launch → `oniro-app logs crash
--wait 15000 --json` reads the newest faultlog: `kind` (`js_crash`, `cpp_crash`,
`app_freeze`), `reason`, and `file`/`line` of the first project frame. Fix that line.
Steps, freezes, and what to do without `logs crash`:
[`references/crashes.md`](./references/crashes.md).

### Drive a flow (e.g. sign-in)
```
oniro-app dump layout --flat                                  # what is on screen
oniro-app input --type inputText --target "you@example.com" --text 'me@example.com'
oniro-app input --type inputText --target "Password" --text 'secret' --hide-keyboard
oniro-app input --type click --target "Sign in" --target-type Button
oniro-app wait --target "Home" --timeout 15000                # the next screen is up
```
To check the same path again after each change, put it in a flow file and `oniro-app
replay flow.json --launch` (see [`references/device-ui.md`](./references/device-ui.md#flows-replay-a-whole-ui-path)).

### UI validation against a design
`oniro-app screenshot --max-dim 1024 -o /tmp/s.jpg` → read and compare; close-ups with
`--target "<text>"` or `--crop`. Some components render differently across API levels, so
note the project's `compileSdkVersion`.

## Tests

`oniro-app test` builds the module's main and `ohosTest` HAPs, installs both, wakes and
unlocks the screen, runs the Hypium suite with `aa test` and prints one line per case.
Exits 0 when all pass, 1 when a case failed or threw, 2 when the run did not complete
(build failed, test module missing, no device): read `error` and `diagnostics`, not the
counts. `--class Suite#case` runs one case; `--json` gives each case's `status`, `message`
and `stack`, and the app's hilog during the run. Every suite file must be imported and
called from `List.test.ets`, and the ohosTest `module.json5` must list the main module's
`deviceTypes`. Hypium, UI tests with `Driver`, raw `aa test`:
[`references/testing.md`](./references/testing.md).

## When something fails

Look up the exact error text in
[`references/troubleshooting.md`](./references/troubleshooting.md) (`00303060`, `9568332`
sign info inconsistent, `The specified module name is not found`, `The type of command line
tools does not match`, a missing SDK, an unsigned HAP). For API levels, `oniro-app sdk list`
maps SDK versions to them; a `compileSdkVersion` like `6.0.0(20)` means API 20.

## References

This skill is the canonical home for ArkTS / ArkUI app knowledge; the other skills point
here:
- [`references/arkts-strict.md`](./references/arkts-strict.md): ArkTS strict-mode rules.
- [`references/arkui-v2-state.md`](./references/arkui-v2-state.md): ArkUI V2 state,
  `Navigation`, `@Builder`, Node-API threads, and the errors models get wrong, with codes.
- [`references/testing.md`](./references/testing.md): Hypium suites, UI tests, `aa test`.
- [`references/device-ui.md`](./references/device-ui.md): layout, screenshots, input, logs.
- [`references/troubleshooting.md`](./references/troubleshooting.md): fixes by error text.
- [`references/crashes.md`](./references/crashes.md): crashes, freezes and faultlogs.
- [`references/architecture.md`](./references/architecture.md): Clean-Architecture layering
  (Domain / Data / Presentation).
