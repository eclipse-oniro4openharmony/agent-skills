---
name: ohos-app-dev
description: Develop, build, deploy, and validate OpenHarmony / HarmonyOS applications on a connected device. Use for the inner dev loop (lint → build → deploy → run → inspect logs → UI validation) on an existing project. For project scaffolding use `ohos-app-scaffold`; for system/persistent bundles use `ohos-system-dev`.
---

# OpenHarmony App Dev

Inner-loop skill for working on an **existing** OpenHarmony / HarmonyOS app. Every
toolchain and device action goes through the **`oniro-app` CLI** — a cross-platform,
agent-designed wrapper over `hvigorw` / `ohpm` / `codelinter` / `hdc` / `uitest`:
explicit flags, results on **stdout**, progress/logs on **stderr**, non-zero exit on
failure. Drop to raw `hdc` / `aa` / `bm` only for device operations `oniro-app` does
not cover.

> **Prereqs:** `oniro-app` on PATH (`npm i -g @oniroproject/oniro-app`) plus an installed
> SDK and command-line tools (`oniro-app sdk install <ver>`, `oniro-app cmdtools install`).
> Most commands default to the current directory or accept a trailing `[project-dir]`.

## When to use

Trigger on: "build the app", "deploy / run it on device", "lint these files", "grab the
logs", "take a screenshot", "tap this button", "why is it crashing on launch". For
*creating* a project → `ohos-app-scaffold`. For **system / persistent bundles** (systemui,
launcher, OS-source-tree builds, reboot-to-reload) → `ohos-system-dev`.

## Directives

1. **CLI-first.** Use `oniro-app <cmd>` for build / deploy / device / logs / input /
   capture. It auto-resolves the device serial, the bundle + main ability (from
   `app.json5` / `module.json5`), and built HAP paths. Use raw `hdc`/`aa`/`bm` only when
   no `oniro-app` command fits — and prefer adding the recipe here over guessing.
2. **Lint before you iterate.** After editing `.ets` / `.ts` / `.cpp` / `.h`, run
   `oniro-app lint --files <changed globs>` (or `oniro-app lint` for the whole project).
   Resolve errors; justify warnings.
3. **Device serial.** `oniro-app devices`. If more than one target, set
   `ONIRO_DEVICE_SERIAL` (or pass `--device <serial>`). Never silently pick one.
4. **Act on elements, not coordinates.** See what is on screen with `oniro-app dump layout
   --flat`, then act by label: `oniro-app input --type click --target "Sign in"`. It skips
   elements another layer covers (a dialog, a scrim, the keyboard) and prefers clickable
   matches; when several match it fails and lists them as `[i] …` — pick one with
   `--target-index i`, or narrow with `--target-type Button` / `--target-id <id>`. With no
   label to match, pass the element's 0–1 center as fractions (`--fx 0.5 --fy 0.62`), the
   same space as `dump layout` and the screenshot grid. Pixels (`--x/--y`) are a last resort.
5. **Wait for the UI, don't sleep.** After an action that changes the screen, wait for the
   result before the next step: `oniro-app wait --target "<text>" --timeout 10000`, or
   `--gone` for a spinner or dialog to disappear. Acting on a stale layout hits the wrong
   element.

## Inner-loop workflow

1. **Edit** sources.
2. **Lint** — `oniro-app lint --files <changed files>`.
3. **Build** — `oniro-app build` — auto-runs `ohpm install --all` when `oh_modules/` is
   missing, builds, then discovers HAPs. Flags: `--module <m>` / `--product <p>` /
   `--mode release` for non-default targets, `--json` to print the discovered HAP paths,
   `--no-deps` to skip the ohpm step. On a fresh clone with an empty `signingConfigs`, run
   `oniro-app sign --bootstrap` first (needs `java`): it writes `signingConfigs` into
   `build-profile.json5` and keys into `signatures/` — local dev material, never commit it.
4. **Device** — `oniro-app devices`; stop and tell the user if empty.
5. **Deploy** — `oniro-app app apply` — verified install: handles sign-info-inconsistent
   (uninstall+install for a normal app), asset-cache invalidation (reboot), and
   persistent-bundle restart, and prints `method` / pre+post pid. Use `oniro-app app
   install` for a plain `hdc install`.
6. **Launch** — `oniro-app app launch` (reads bundle + ability automatically; `--ability
   <name>` / `--module <m>` to target a specific one).
7. **Observe**
   - **Logs (bounded):** `oniro-app watch --log '<regex>' --for 5000` collects matches for
     a window; `oniro-app wait --log '<regex>' --timeout 30000 [--bundle <b>]` returns the
     instant a line matches (perfect for "did action X fire?"). Fallback:
     `hdc shell hilog -x | grep -E ...`.
   - **Screenshot:** `oniro-app screenshot --max-dim 1024 -o /tmp/s.jpg` then read
     `/tmp/s.jpg` (`--grid` adds a 10×10 grid with 0.0–1.0 axes). For detail — small text,
     an icon, a rendering glitch — crop rather than reading the whole screen at full
     resolution: `--target "<text>"` (one element plus a margin) or `--crop x1,y1,x2,y2`
     (0–1 fractions). A bare `oniro-app screenshot` writes the full-resolution JPEG, which
     is expensive to read.
   - **Transient UI / animations / boot:** `oniro-app screenshot --contact-sheet -o
     /tmp/cs.jpg` — captures a burst (default 8 frames, `--burst N` / `--interval ms`)
     into **one** tiled, index-labelled sheet and prints per-frame change diffs (0..1) on
     stdout. The highest-diff frame is where it changed — one image instead of N.
   - **Layout:** `oniro-app dump layout --flat` — one line per labelled or interactive
     element, grouped by window, centers `c=` as 0–1 fractions:
     ```
     [window com.example.app]
     TextInput hint="you@example.com" c=0.500,0.320 click focus
     Button "Sign in" c=0.500,0.520 click
     Text "Home" c=0.120,0.950 covered
     [keyboard com.example.ime] up — dismiss with input --type hideKeyboard
     ```
     `covered`: another layer paints over it, so a tap there hits that layer. `hint`: a
     placeholder. `disabled`: won't respond. Drop `--flat` for the JSON tree.
   - **Drive:** `oniro-app input --type <type>`, positioned with `--target` / `--fx --fy` /
     `--x --y`: `click`, `doubleClick`, `longClick`, `swipe`/`drag`/`fling` (end point
     `--fx2 --fy2`, `--speed`), `keyEvent --key <key>` (`Back`, `Home`, `Enter`, `Tab`,
     `Delete`, `Escape`, `MoveHome`/`MoveEnd`, a letter, a KeyCode id, or a combo like
     `Ctrl+A`). Held / multi-segment paths: `oniro-app gesture --fractions --waypoints
     '[{"x":0.5,"y":0.8,"t":0},{"x":0.5,"y":0.3,"t":400}]' [--hold-start ms]`.
   - **Text fields:** `input --type inputText --target "<placeholder or current text>"
     --text '...'` types into the field. It appends; add `--clear` to replace the contents,
     or use `--type clearText` to empty the field. The soft keyboard stays up after typing
     and covers the bottom of the screen: add `--hide-keyboard`, or run `input --type
     hideKeyboard`, which presses Back only when the keyboard is shown. A bare `keyEvent
     --key Back` with no keyboard up navigates away from the page.
8. **Stop / clean up** — `oniro-app app stop <bundle>`.

## Recipes

### Quick rebuild & reinstall
`oniro-app lint --files <files>` → `oniro-app build` → `oniro-app app apply` →
`oniro-app app stop <bundle>` → `oniro-app app launch`.

### Diagnose a runtime crash
`oniro-app app launch` to reproduce → `oniro-app watch --log 'FATAL|SIGSEGV| E ' --for 8000`
(or `hdc shell hilog -x | grep -E 'FATAL|SIGSEGV'`). For native faults, list
`/data/log/faultlog/faultlogger` via `hdc shell ls …` and pull the entry with
`oniro-app file recv <remote> <local>`.

### Drive a flow (e.g. sign-in)
```
oniro-app dump layout --flat                                  # what is on screen
oniro-app input --type inputText --target "you@example.com" --text 'me@example.com'
oniro-app input --type inputText --target "Password" --text 'secret' --hide-keyboard
oniro-app input --type click --target "Sign in" --target-type Button
oniro-app wait --target "Home" --timeout 15000                # the next screen is up
```

### UI validation against a design
`oniro-app screenshot --max-dim 1024 -o /tmp/s.jpg` → read & compare; close-ups with
`--target "<text>"` or `--crop`. Read `build-profile.json5` for the target API level
(table below) — some components render differently across levels.

### Dependency change
Edit `oh-package.json5` → `oniro-app build` (re-runs `ohpm install` when needed).

### Common raw-device ops (no dedicated command)
- List targets: `hdc list targets -v`
- Force-stop: `hdc shell aa force-stop <bundle>`  (or `oniro-app app stop <bundle>`)
- Push / pull: `oniro-app file send <local> <remote>` / `oniro-app file recv <remote> <local>`
- Set a system prop: `hdc shell param set <key> <value>`
- Reboot: `oniro-app reboot` (see `ohos-system-dev` for reboot-to-reload).
- Add a photo to the gallery (for photo-picker flows): `oniro-app file send img.jpg
  /data/local/tmp/x.jpg` → `hdc shell mediatool send /data/local/tmp/x.jpg`. In the system
  picker, tapping a thumbnail opens a preview: tap its selection circle, then Done.

## SDK / API level reference

Run `oniro-app sdk list` for the version↔API-level mapping (and which SDKs are installed).
Read `build-profile.json5` for `compatibleSdkVersion` / `targetSdkVersion`; if the version
embeds the API level in parentheses (e.g. `6.0.0(20)`), that number **is** the API level.

## Out of scope

- Scaffolding / templating a fresh project → `ohos-app-scaffold`.
- System / persistent bundles, OHOS source-tree builds, sign-cert traps, reboot-to-reload
  → `ohos-system-dev`.

## References

App-engineering knowledge for ArkTS / ArkUI work — this skill is the canonical home; the
other skills point here rather than restating it:
- [`references/arkts-strict.md`](./references/arkts-strict.md) — ArkTS strict-mode rules the
  compiler / `oniro-app lint` enforce.
- [`references/architecture.md`](./references/architecture.md) — Clean-Architecture layering
  for ArkTS apps (Domain / Data / Presentation).
- [`references/troubleshooting.md`](./references/troubleshooting.md) — common `oniro-app`
  build / SDK failures and fixes.
