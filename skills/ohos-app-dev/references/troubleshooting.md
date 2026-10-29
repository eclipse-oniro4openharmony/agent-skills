# OpenHarmony App Troubleshooting (CLI-first)

All build/device actions go through the **`oniro-app` CLI**. Most failures surface on
**stderr** with a non-zero exit; read that first. Common cases:

## Build

### `oniro-app build` fails before compiling (toolchain not found)
- **Cause:** no SDK / command-line tools installed, or `oniro-app` can't locate them.
- **Fix:** `oniro-app sdk list` and `oniro-app cmdtools status` to check; install with
  `oniro-app sdk install <ver>` / `oniro-app cmdtools install`. `oniro-app build` probes the
  project-local `hvigorw` and transparently falls back to the cmd-tools `hvigorw` when a
  vendored wrapper is broken — you do not invoke `hvigorw` yourself.

### "SDK API N is not installed" / hvigor `00308018` "SDK path does not exist …\N"
- **Cause:** the project compiles against an OpenHarmony SDK (`compileSdkVersion` in
  `build-profile.json5`) that is not installed. hvigor's own message may instead say "SDK
  license agreement is not accepted".
- **Fix:** run `oniro-app sdk install <ver>` with the release the error names, or
  `oniro-app build --install-sdk`, which installs it and builds. Installing the SDK the
  project targets is an environment step, not a project defect.

### `oniro-app build` fails with an ArkTS or native compile error
- **Cause:** a source error — ArkTS strict mode, a missing dependency, or native/CMake.
- **Fix:**
  1. Read the failing task in the stderr log (e.g. `CompileArkTS`, `BuildNativeWithCmake`).
  2. `oniro-app lint --files <changed files>` catches ArkTS strict-mode violations early
     (see [`arkts-strict.md`](./arkts-strict.md)).
  3. Dependency change: edit `oh-package.json5`, then `oniro-app build` — it re-runs
     `ohpm install` when `oh_modules/` is missing (`--no-deps` to skip).

### Dozens of "'X' is not exported from Kit '@kit.…'" errors (a system-API app)
- **Example:** `'config' is not exported from Kit '@kit.AccessibilityKit'`.
- **Cause:** the code calls system APIs (`@systemapi`), which the **public** SDK that
  `oniro-app sdk install` downloads leaves out. The **full** SDK has them. `oniro-app build`
  adds this hint to its error.
- **Fix:** get the full SDK for the project's API level (the project's README usually links
  the build it was developed with). Unpack its components (`ets`, `js`, `native`,
  `previewer`, `toolchains`) into `<root>/<os>/<api>/` of a separate SDK root, where
  `<os>` is `windows`, `linux` or `darwin`, so the public install stays untouched. Then
  build with `ONIRO_SDK_ROOT_DIR=<root>`. Such an app also needs privileged signing to
  install (next section).

### "No signed HAPs found" / unsigned HAP
- **Cause:** no `signingConfigs` configured — `oniro-app build` does not sign.
- **Fix:** depends on the target:
  - **HarmonyOS emulator:** nothing to do. It installs the unsigned HAP, and `app apply` /
    `app install` fall back to it.
  - **OpenHarmony device or Oniro emulator:** `oniro-app sign`, then build again. It also
    points any product with no `signingConfig` at the generated config. Without that link
    the build stays unsigned even though a config exists.
  - **HarmonyOS device:** `oniro-app sign --harmonyos` (needs `oniro-app auth login`).
  - **Build-only check:** safe to ignore.

## Signing & install

hdc exits 0 even when the bundle manager rejects a HAP; `oniro-app app install` / `app
apply` turn the `code:95xxxxx` in its output into an error. Common codes:

| Code / message | Cause | Fix |
|---|---|---|
| `9568320` no signature file | An unsigned HAP on a target that requires signing (any OpenHarmony device). | `oniro-app sign` (or `sign --harmonyos` for a HarmonyOS device), then build again. |
| `9568289` grant request permissions failed | The app requests permissions above its APL. | `oniro-app sign --apl system_basic` or `system_core`, plus `--acls <perm,…>` for ACL-only permissions. |
| `9568344` not allow use privilege extension | A privileged extension ability (e.g. `AccessibilityExtensionAbility`) without the profile capability. | `oniro-app sign --apl system_core --acls … --app-privilege-capabilities AllowAppUsePrivilegeExtension` |
| `9568332` sign info inconsistent | An installed copy is signed with other certs. | `oniro-app app apply` uninstalls and reinstalls a normal app; for system bundles see `ohos-system-dev`. |
| `9568337` install parse unexpected | Not a valid HAP (truncated, or not a HAP at all). | Rebuild; check the path. |

The team's own profile template (often `signing/*.json`) shows which `apl`, `acls` and
`app-privilege-capabilities` a system app expects.

## Device & targets

### `[Fail]ExecuteCommand need connect-key?`
- **Cause:** more than one target is connected and the command did not name one.
- **Fix:** `export ONIRO_DEVICE_SERIAL=<serial>` (from `oniro-app devices`) or pass
  `--device <serial>`. Every `oniro-app` command honours both, TCP serials such as
  `127.0.0.1:5555` included. For raw hdc use `oniro-app hdc …`, which adds the `-t`.

### `hdc: command not found`
- **Cause:** hdc ships inside the command-line tools
  (`<cmdtools>/sdk/default/openharmony/toolchains/`), not on PATH.
- **Fix:** `oniro-app hdc <args>` runs it; `oniro-app hdc --path` / `oniro-app cmdtools
  status` print where it is.

### An app with native (C++/NAPI) libraries fails on the HarmonyOS emulator
- **Cause:** a CPU-ABI mismatch, which shows up at install or when the native module loads.
  The HarmonyOS emulator is x86_64; many apps ship arm64-only native libraries.
- **Fix:** compare `abi=` in `oniro-app devices --long` with the HAP's `libs/<abi>/`
  folders (`unzip -l app.hap | grep libs/`). Run the app on an arm64 device; the
  emulator cannot run it.

### The app cannot read a file you pushed
- **Cause:** `hdc file send` writes files as root, and an app runs as its own user.
- **Fix:** `oniro-app file send <local> <path inside the sandbox> --bundle <bundle>` chowns
  the file to the app (see the recipe in `SKILL.md`).

### `file send` / `file recv` say the device path is a Windows path
- **Cause:** Git Bash rewrote `/data/…` into `C:/Program Files/Git/data/…`.
- **Fix:** prefix the command with `MSYS_NO_PATHCONV=1`, or run it from PowerShell.

## Lint

### "The type of command line tools does not match that of the project"
- **Cause:** codelinter checks only projects of its own flavour fully. Command-line tools
  from the Huawei developer portal are the HarmonyOS flavour (`oniro-app cmdtools status`
  shows `flavour:`), and a project whose `runtimeOS` is OpenHarmony gets a partial run,
  followed by "Some error occurred during linting. This may cause incomplete report
  results."
- **Effect:** `oniro-app lint` still prints what codelinter found, plus a warning that the
  report is incomplete. Treat the counts as a lower bound, and say so when you report them.
  The build's ArkTS compiler checks do not depend on this.
- **Fix (full report):** point `ONIRO_CMD_TOOLS_PATH` at command-line tools of the project's
  flavour.

## Logs

### Lines from the start of the session are missing from the log
- **Cause:** the device's hilog buffer is 256 KB per type, and chatty components such as
  ArkWeb/Chromium wrap it within seconds, so `hilog -x` at the end only shows the tail.
- **Fix:** run `oniro-app logs --clear -o hilog_full.txt` in the background for the whole
  session, and filter the file afterwards.

## SDK / API level

`oniro-app sdk list` shows installed SDKs and their API levels. If `build-profile.json5`
embeds the API in parentheses (e.g. `6.0.0(20)`), that number is the API level.

---

For the full inner-loop workflow (deploy, logs, UI) see the parent **`ohos-app-dev`** skill;
for system / persistent bundles see **`ohos-system-dev`**.
