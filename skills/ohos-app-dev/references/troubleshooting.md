# Troubleshooting by error text

Find the text you are looking at, then apply the fix. Most `oniro-app` failures are on
stderr with a non-zero exit; with `--json`, `build`, `check arkts` and `test` put them in
`diagnostics` and `error` instead. `oniro-app doctor` checks the whole setup (SDK, tools,
device, signing) and says which line below applies.

## Build and check

| Error text (or part of it) | Where | Meaning | Fix |
| --- | --- | --- | --- |
| `00303060 Configuration Error` … `intersection of the system capability sets` … `is empty` | `build`, `test`, at `SyscapTransform` | A module's `deviceTypes` names a device with no syscap set in this SDK, usually an `ohosTest` module saying `"phone"` beside a main module saying `"default"` | Make the `ohosTest` `module.json5` `deviceTypes` equal the main module's |
| `SDK API <n> is not installed at <path>` | `build`, `check arkts`, `doctor` | The project's `compileSdkVersion` names an API level with no SDK here | `oniro-app sdk install <version>`, the release for that API (`oniro-app sdk list` maps them), or `oniro-app doctor --fix` |
| `The type of command line tools does not match that of the project` | `lint` (codelinter) | The command-line tools are the other flavour (HarmonyOS tools on an OpenHarmony project, or the reverse); `lint` reports `incomplete` and exits 2 | Use `oniro-app check arkts`, which does not need codelinter. A clean `lint` from these tools proves nothing |
| `Module '"./X"' declares 'Y' locally, but it is not exported` | `check arkts`, `build` | The imported file has `Y` but does not export it | Add `export`, or `check arkts --fix` |
| `File '…/X.ets' is not a module` | `check arkts`, `build` | The imported file exports nothing at all | Add `export` to what the importer imports, or `check arkts --fix` |
| `Property 'x' does not exist on type 'Y'` (10505001) | `check arkts`, `build` | An API member that does not exist, or not at this API level | `oniro-app api show Y.x` says whether this API level declares it and names close matches; `oniro-app docs search "Y x"` shows how it is used; see [`arkui-v2-state.md`](./arkui-v2-state.md) |
| `"completed": false`, exit 2 | `check arkts` | The checker did not run (no SDK, a crash) | Read `error`; this is not a pass |
| hvigor `00308018` `SDK path does not exist …\N`, or `SDK license agreement is not accepted` | `build` | Same as `SDK API <n> is not installed`: the project's OpenHarmony SDK is missing | `oniro-app build --install-sdk` installs it and builds; an environment step, not a project defect |
| Dozens of `'X' is not exported from Kit '@kit.…'` | `build`, `check arkts` | The code calls system APIs (`@systemapi`), which the **public** SDK `sdk install` downloads leaves out | Get the **full** SDK for the API level; unpack its `ets`, `js`, `native`, `previewer`, `toolchains` into `<root>/<linux\|windows\|darwin>/<api>/` of a separate root and build with `ONIRO_SDK_ROOT_DIR=<root>`. Installing needs privileged signing (`9568289`/`9568344` below) |
| `No signed HAPs found` | `build` | `signingConfigs` is empty, so the HAP is unsigned | Per target: HarmonyOS emulator, nothing (it installs the unsigned HAP and `app apply` falls back to it); OpenHarmony device or Oniro emulator, `oniro-app sign` (`--bootstrap` on a fresh clone; needs `java`), then build again (it also links products that had no `signingConfig`); HarmonyOS device, `oniro-app sign --harmonyos`. The keys in `signatures/` are local dev material: never commit them. Safe to ignore for a build-only check |

For ArkTS rule and ArkUI component-model errors, the catalogue with codes and fixes is in
[`arkui-v2-state.md`](./arkui-v2-state.md#catalogue-what-models-get-wrong-as-the-tools-report-it);
the strict-mode rules in [`arkts-strict.md`](./arkts-strict.md).

## Install, launch and test

| Error text (or part of it) | Where | Meaning | Fix |
| --- | --- | --- | --- |
| An install fails on signature or certificate errors, or you are not sure what signed a HAP | `app install`, `app apply` | The HAP may be unsigned, expired, signed for another bundle, or signed with OpenHarmony material for a HarmonyOS device | `oniro-app app verify <hap>`: signer (OpenHarmony development material or HarmonyOS AGC), chain, profile type, bundle, expiry; exit 1 says what is wrong |
| `9568332` / `sign info inconsistent` | `hdc install`, `app install` | The installed copy is signed with other keys | `oniro-app app apply`, which uninstalls and reinstalls a normal app (it refuses for a system bundle: see `ohos-system-dev`) |
| `9568320` no signature file | `app install`, `app apply` | An unsigned HAP on a target that requires signing (any OpenHarmony device) | `oniro-app sign` (or `sign --harmonyos` for a HarmonyOS device), then build again |
| `9568289` grant request permissions failed | `app install`, `app apply` | The app requests permissions above its APL | `oniro-app sign --apl system_basic` or `system_core`, plus `--acls <perm,…>` for ACL-only permissions. The team's profile template (often `signing/*.json`) shows what a system app expects |
| `9568344` not allow use privilege extension | `app install`, `app apply` | A privileged extension ability (e.g. `AccessibilityExtensionAbility`) without the profile capability | `oniro-app sign --apl system_core --acls … --app-privilege-capabilities AllowAppUsePrivilegeExtension` |
| `9568337` install parse unexpected | `app install` | Not a valid HAP (truncated, or not a HAP at all) | Rebuild; check the path |
| `The specified module name is not found` | `test`, `aa test` | The test HAP is not installed, or its module is not `<module>_test` | `oniro-app test` (it installs both HAPs); with raw `aa test`, install the `ohosTest` HAP and pass `-m entry_test` |
| `getCurrentTopAbility` fails, or UI tests find nothing | `test` | The screen is locked or off | `oniro-app test` wakes and swipes an unsecured lock screen; with a PIN, unlock the device yourself |
| `no device or emulator reachable` | `doctor`, any device command | `hdc list targets` is empty | Connect or start one (`oniro-app emulator start`), then `oniro-app devices` |
| several devices, the command refuses to pick; raw hdc says `[Fail]ExecuteCommand need connect-key?` | any device command | More than one target | `ONIRO_DEVICE_SERIAL=<serial>` or `--device <serial>`; every command honours both, TCP serials included. For raw hdc, `oniro-app hdc …` adds the `-t` |
| `hdc: command not found` | a raw hdc call | hdc ships inside the command-line tools, not on PATH | `oniro-app hdc <args>`; `oniro-app hdc --path` prints where it is |
| A native (C++/NAPI) app fails to install or load on the HarmonyOS emulator | `app install`, launch | CPU-ABI mismatch: that emulator is x86_64, many apps ship arm64-only libraries | Compare `abi=` in `oniro-app devices --long` with the HAP's `libs/<abi>/`; run it on an arm64 device |
| The app cannot read a file you pushed | the app at run time | `hdc file send` writes as root; the app runs as its own user | `oniro-app file send <local> <sandbox path> --bundle <bundle>` ([`device-ui.md`](./device-ui.md#give-the-app-a-file-a-model-a-fixture-a-database)) |
| `file send` / `file recv` say the device path is a Windows path | `file send`, `file recv` (Git Bash) | Git Bash rewrote `/data/…` into `C:/Program Files/Git/data/…` | Prefix with `MSYS_NO_PATHCONV=1`, or run from PowerShell |
| Lines from the start of the session are missing from the log | `hilog`, `logs` | The 256 KB hilog buffer wraps within seconds under chatty components (ArkWeb) | `oniro-app logs --clear -o hilog_full.txt` in the background for the whole session |

## Toolchain

| Symptom | Fix |
| --- | --- |
| `oniro-app build` fails before compiling, toolchain not found | `oniro-app doctor`; then `oniro-app sdk install <ver>` / `oniro-app cmdtools install` |
| `doctor` says `partial install: missing …` for the tools | A failed install left half a toolchain: `oniro-app cmdtools install --force` |
| `Property … does not exist` errors inside `oh_modules/`, with a hint that a dependency may need a newer API level | The dependency uses APIs newer than the SDK the build used (named at the end of the build output and in `build --json` `sdk`): raise `compileSdkVersion` and install that SDK, or pin an older dependency version |
| `targets HarmonyOS, but its signingConfig … holds OpenHarmony material` (build warning) | The HAP will not install on a HarmonyOS device: `oniro-app sign --harmonyos` (needs `oniro-app auth login`; on a host without a browser, `auth login --no-browser` and paste the callback address, or `--port <n>` with an ssh tunnel) |
| `cmdtools status` / `sdk list` and the HarmonyOS SDK | `cmdtools status` names the SDK the command-line tools carry (HarmonyOS or OpenHarmony, API level); `cmdtools install --force` says which release it replaces |
| A dependency was added and the build cannot find it | Edit `oh-package.json5`, then `oniro-app build` (it runs `ohpm install` when `oh_modules/` is missing) |

`build` falls back to the command-line tools' `hvigorw` when the project's own wrapper is
broken; you do not run `hvigorw` yourself.
