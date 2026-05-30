---
name: ohos-system-dev
description: Develop, build, deploy, and verify OpenHarmony SYSTEM / persistent bundles (e.g. systemui, launcher) and components built inside the OHOS source tree. Use when the target is a platform component rather than a normal app — multi-module assembleHap, install-and-reboot-to-reload, signing/cert traps, and verifying the new code actually loaded. For normal apps use `ohos-app-dev`.
---

# OpenHarmony System Dev

Platform work has its own rules that normal-app development doesn't. A system/persistent
bundle (systemui, launcher, a gesture-nav service) is **not** reloaded by reinstalling it —
it reloads on **reboot** — and it's signed/installed differently. This skill captures that
loop. Everything routes through the **`oniro-app` CLI** (cross-platform; stdout=results,
stderr=logs) with raw `hdc` / `bm` / `param` as the escape hatch.

> Platform builds assume access to an OHOS **source tree** and a device/emulator that
> accepts system bundles (a dev image, or `system_app` signing). Paths like
> `applications/standard/systemui` below are illustrative.

## When to use

"Build/deploy systemui (or another system bundle)", "install a persistent service",
"build a component in the OHOS source tree", "it installed but the change didn't take",
"sign a system HAP", "reboot and check the service came back". Normal standalone app →
`ohos-app-dev`.

## The core difference: install ≠ reload

Reinstalling a persistent bundle with `hdc install -r` does **not** restart it; `aa
force-stop` / `kill -9` of a system process is typically blocked. The new code loads only
after a **reboot**, and you must then verify a **fresh pid**.

Use **`oniro-app app apply`** — it encodes the three failure modes a naive "install the
newest signed HAP" gets wrong:
1. **Sign-info-inconsistent (`9568332`)** on `-r` when certs differ → for a normal app it
   uninstalls + installs; for a **system bundle it refuses** (uninstalling systemui can
   brick the device) unless you pass an explicit allow-uninstall.
2. **Asset-cache invalidation** — if the new HAP added/renamed asset paths, the path-keyed
   ACE extractor cache survives a process kill and serves stale assets → it reboots.
3. **Persistent-bundle restart** — if the pid didn't change after install, it reboots and
   waits for a fresh pid.

```
oniro-app app apply --module <module>          # resolves the module's HAP, installs, verifies
oniro-app reboot --wait-for-bundle <bundle>    # when you need an explicit reload
oniro-app wait --boot --pid-of <process>       # block until the device is back AND the proc has a pid
```

## Build

- **Standalone module / multi-module assembleHap** (against the installed SDK): use
  `oniro-app build` — it already emits the systemui-style invocation. For one module of a
  many-module project, name it so the *right* HAP is installed:
  ```
  oniro-app build --product default --module phone_gestureNavigation
  oniro-app build --json     # prints module → HAP paths; deploy the named module, never "most recent"
  ```
  `oniro-app build` probes the project-local `hvigorw`; HMOS-vendored projects ship a
  broken local wrapper, so it transparently falls back to the cmd-tools `hvigorw` — you
  don't need to shell out to a global `hvigorw` yourself.
- **Inside the OHOS source tree** (full image / component): that's the OS build system
  (e.g. `./build.sh --product-name <x> --ccache`, or the vendor docker image), **not**
  `oniro-app build`. After a `--fast-rebuild`, beware the **staleness trap**: the freshly
  built artifact under `out/.../oniro_soc_products/...` may differ from what's packaged
  under `packages/phone/...` — verify you're deploying the just-built file.

## Signing realities

- `signatures/` and the `signingConfigs` block of `build-profile.json5` are usually
  **gitignored** (outside HEAD). On a fresh worktree, bootstrap them before building:
  ```
  oniro-app sign --bootstrap        # no-op if present; else generates dev signing material
  ```
- **Dev images** often bypass HAP signature checks; production devices do not.
- System bundles need **`system_app`**-tier signing (vs `hos_normal_app`); a mismatch shows
  up as the `9568332` sign-info-inconsistent error on `-r` (see `app apply` above).

## Verify the new code actually loaded

A reboot is ~70 s — don't guess. After `app apply` / `reboot`:
```
oniro-app wait --boot --pid-of <process> --timeout 120000   # fresh pid required
oniro-app wait --log '<a line your change emits>' --timeout 60000
```
Compare the pre/post pid (an unchanged pid = the bundle didn't reload). To confirm the
on-device artifact is yours, `hdc shell bm dump -n <bundle>` for its path, or `strings` the
installed HAP.

## Instrument BEFORE the expensive deploy

The single biggest time-saver on persistent bundles: before an `app apply` + reboot cycle,
add `hilog` at **every** suspect point in one pass. One ~70 s reboot then yields the answer,
instead of one log-point per cycle. Cutting 4 iterations to 1 saves minutes and a lot of
intermediate screenshots/logs.

## Inspect window / render state without a rebuild

When a UI bug is about z-order / surface presence rather than logic:
```
hdc shell hidumper -s WindowManagerService -a -a    # windows in z-order, surface presence
hdc shell hidumper -s RenderService -a allInfo      # composition / refresh state
```

## Gotchas

- **Search scoping:** the OHOS tree is huge — a `grep`/find from the root times out. Always
  scope to a subdirectory (e.g. the component path).
- **Gesture injection:** `oniro-app input` (uitest) **does** reach `inputMonitor`-based
  services. Use `oniro-app gesture --hold-start/--hold-end` (raw uinput) only when you need
  press-time control — and note `uinput`'s `-g` form silently no-ops if press < 500 ms.
- **Verify transient UI** (gesture arrows, boot animation) with
  `oniro-app screenshot --contact-sheet` — a single burst sheet beats guessing capture timing.
- **Reboot modes:** `oniro-app reboot` (to OS). For bootloader/recovery, the underlying
  `hdc shell reboot <mode>`; the canonical OS reboot is `param set ohos.startup.powerctrl reboot`.

## Reference

API-level mapping and the normal inner-loop commands live in **`ohos-app-dev`** — this skill
only adds the system/persistent specifics on top of it.
