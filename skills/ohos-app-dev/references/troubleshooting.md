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
| `Property 'x' does not exist on type 'Y'` (10505001) | `check arkts`, `build` | An API member that does not exist, or not at this API level | Look it up in the SDK's `.d.ts` and its `@since`; see [`arkui-v2-state.md`](./arkui-v2-state.md) |
| `"completed": false`, exit 2 | `check arkts` | The checker did not run (no SDK, a crash) | Read `error`; this is not a pass |
| `No signed HAPs found` | `build` | `signingConfigs` is empty, so the HAP is unsigned and most targets refuse it | `oniro-app sign` (`--bootstrap` on a fresh clone), then build again |

For ArkTS rule and ArkUI component-model errors, the catalogue with codes and fixes is in
[`arkui-v2-state.md`](./arkui-v2-state.md#catalogue-what-models-get-wrong-as-the-tools-report-it);
the strict-mode rules in [`arkts-strict.md`](./arkts-strict.md).

## Install, launch and test

| Error text (or part of it) | Where | Meaning | Fix |
| --- | --- | --- | --- |
| `9568332` / `sign info inconsistent` | `hdc install`, `app install` | The installed copy is signed with other keys | `oniro-app app apply`, which uninstalls and reinstalls a normal app (it refuses for a system bundle: see `ohos-system-dev`) |
| `The specified module name is not found` | `test`, `aa test` | The test HAP is not installed, or its module is not `<module>_test` | `oniro-app test` (it installs both HAPs); with raw `aa test`, install the `ohosTest` HAP and pass `-m entry_test` |
| `getCurrentTopAbility` fails, or UI tests find nothing | `test` | The screen is locked or off | `oniro-app test` wakes and swipes an unsecured lock screen; with a PIN, unlock the device yourself |
| `no device or emulator reachable` | `doctor`, any device command | `hdc list targets` is empty | Connect or start one (`oniro-app emulator start`), then `oniro-app devices` |
| several devices, the command refuses to pick | any device command | More than one target | `ONIRO_DEVICE_SERIAL=<serial>` or `--device <serial>` |

## Toolchain

| Symptom | Fix |
| --- | --- |
| `oniro-app build` fails before compiling, toolchain not found | `oniro-app doctor`; then `oniro-app sdk install <ver>` / `oniro-app cmdtools install` |
| `doctor` says `partial install: missing …` for the tools | A failed install left half a toolchain: `oniro-app cmdtools install --force` |
| A dependency was added and the build cannot find it | Edit `oh-package.json5`, then `oniro-app build` (it runs `ohpm install` when `oh_modules/` is missing) |

`build` falls back to the command-line tools' `hvigorw` when the project's own wrapper is
broken; you do not run `hvigorw` yourself.
