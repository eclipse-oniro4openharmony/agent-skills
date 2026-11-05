# Seeing and driving the UI on the device

The targets, and the `oniro-app` commands that look at the screen and act on it, in the
detail `SKILL.md` leaves out. All of them auto-resolve the device (`ONIRO_DEVICE_SERIAL` or
`--device` when several are connected).

## Targets

Pick the target per app: its platform (`runtimeOS` in `build-profile.json5`; a version
like `"6.0.0(20)"` also means HarmonyOS) and an API level ≥ `compatibleSdkVersion`.

| Target | Typical serial | Signing | Notes |
|---|---|---|---|
| OpenHarmony / Oniro device | USB serial | `oniro-app sign` (local) | `--apl`/`--acls` for system permissions (see troubleshooting). |
| Oniro emulator | `127.0.0.1:55555` | `oniro-app sign` (local) | `emulator start --wait-ready 180`; pool instance n at `127.0.0.1:<55555+n>`. |
| HarmonyOS emulator (DevEco) | `127.0.0.1:5555` | **none**: installs unsigned HAPs | x86_64 only: a HAP whose native `.so` files are arm64-only cannot run there. |
| HarmonyOS device | USB serial | `oniro-app sign --harmonyos` (AGC account) | Registers the device with AppGallery Connect. |

`oniro-app devices --long` names each one:

```
127.0.0.1:5555  TCP  Connected  os="HarmonyOS 6.1.0"  api=24  abi=x86_64  type=phone  model=emulator  fullname=OpenHarmony-6.1.1.125
GS6CTU300263    USB  Connected  os=OpenHarmony       api=26  abi=arm64-v8a  type=default  model=ohos  fullname=OpenHarmony-7.0.0.39
```

`abi=` is what native libraries must match (`unzip -l app.hap | grep libs/`). `app apply`
installs the newest signed HAP, else the unsigned one (the HarmonyOS emulator). Before
installing another app that may share a template bundle name (`com.example.*`), `oniro-app
app uninstall <bundle>`.

## Layout

`oniro-app dump layout --flat`: one line per labelled or interactive element, grouped by
window, centers `c=` as 0–1 fractions:

```
[window com.example.app]
TextInput hint="you@example.com" c=0.500,0.320 click focus
Button "Sign in" c=0.500,0.520 click
Text "Home" c=0.120,0.950 covered
[keyboard com.example.ime] up — dismiss with input --type hideKeyboard
```

- `covered`: another layer paints over it, so a tap there hits that layer. `hint`: a
  placeholder. `disabled`: won't respond. Drop `--flat` for the JSON tree.
- **Visible area only.** The dump lists what is on screen now, not the rest of a list or a
  scrolled page. An element you expect but do not see is probably off screen: scroll
  (`input --type swipe --fx 0.5 --fy 0.8 --fx2 0.5 --fy2 0.3`) and dump again before
  concluding it is missing.

## Screenshots

- `oniro-app screenshot --max-dim 1024 -o /tmp/s.jpg`, then read `/tmp/s.jpg`. `--grid`
  adds a 10×10 grid with 0.0–1.0 axes, the same space as `--fx/--fy`.
- Close-ups instead of reading the whole screen at full resolution: `--target "<text>"`
  (one element plus a margin) or `--crop x1,y1,x2,y2` (0–1 fractions). A bare
  `oniro-app screenshot` writes the full-resolution JPEG, which is expensive to read.
- Transient UI, animations, boot: `oniro-app screenshot --contact-sheet -o /tmp/cs.jpg`
  captures a burst (default 8 frames, `--burst N`, `--interval ms`) into one tiled,
  index-labelled sheet and prints per-frame change (0..1) on stdout. The frame with the
  highest change is where the screen changed.

## Input

`oniro-app input --type <type>`, positioned with `--target` / `--fx --fy` / `--x --y`:

- `click`, `doubleClick`, `longClick`.
- `swipe`, `drag`, `fling`: end point `--fx2 --fy2`, `--speed`.
- `keyEvent --key <key>`: `Back`, `Home`, `Enter`, `Tab`, `Delete`, `Escape`,
  `MoveHome`/`MoveEnd`, a letter, a KeyCode id, or a combo like `Ctrl+A`.
- Held or multi-segment paths: `oniro-app gesture --fractions --waypoints
  '[{"x":0.5,"y":0.8,"t":0},{"x":0.5,"y":0.3,"t":400}]' [--hold-start ms]`.

`--target` skips elements another layer covers and prefers clickable matches; when several
match it fails and lists them as `[i] …`: pick one with `--target-index i`, or narrow with
`--target-type Button` / `--target-id <id>`.

**Selectors.** When a label is ambiguous or changes, `--selector` takes an exact
expression instead of `--target*` (the two do not combine), on `input`, `wait`,
`screenshot` and `dump layout`:

- Attributes: `--selector 'type=Button,text*=Sign'`. Keys `text`, `desc`, `hint`, `id`,
  `key`, `type`, and `enabled`/`focused`/`checked`/`selected`/`visible`/`clickable`/
  `scrollable` (`true`/`false`). Operators `=`, `*=` contains, `^=` prefix, `$=` suffix, `/=`
  regex. `[n]` picks the n-th match (0-based) of the list `dump layout --selector '<expr>'
  --flat` prints. Quote a value holding `,` or `[`: `id/="^item[0-9]$"`.
- XPath: `--selector 'xpath=//Column[@id="items"]/Text[last()]'` (`//`, `/`, `*`,
  `[@attr="v"]`, `contains()`, `and`/`or`, `[n]` 1-based per parent, `(path)[n]`).
- `wait --selector '<expr>' --gone` waits for it to disappear.

**Windows.** `oniro-app dump windows` lists window ids; `--window <id>` restricts `dump
layout`, `input`, `wait` and `screenshot` to that window (an app's own window, not a
system overlay that happens to be on top).

**Text fields.** `input --type inputText --target "<placeholder or current text>" --text
'...'` types into the field. It appends; add `--clear` to replace the contents, or use
`--type clearText` to empty it. The soft keyboard stays up after typing and covers the
bottom of the screen: add `--hide-keyboard`, or run `input --type hideKeyboard`, which
presses Back only when the keyboard is shown. A bare `keyEvent --key Back` with no keyboard
up navigates away from the page.

## Flows: replay a whole UI path

A flow file is a JSON list of steps (`click`, `inputText`, `swipe`, `keyEvent`, `wait`),
each naming its element by selector and, optionally, what must be on screen afterwards
(`expect`). Write one from the spec, or record one by driving the app by hand:

```json
{ "version": 1, "bundle": "com.example.app",
  "steps": [
    { "action": "inputText", "selector": "type=TextInput,id=email", "text": "me@example.com" },
    { "action": "click", "selector": "type=Button,id=signIn", "expect": "type=Text,id=home" }
  ] }
```

- `oniro-app replay flow.json --launch` runs it from a fresh start. Exit 0 when every step
  ran, 1 when it diverged: the report names the step, the reason (`not-found`,
  `expect-not-found`, `wrong-screen`, `ambiguous`, `covered`), a screenshot, what is on
  screen, and near matches (a button whose text changed). Exit 2: it could not run.
- `oniro-app record --out flow.json --for 30000` turns what you do on the device into a
  flow. While it records, `dump layout` and `input --selector` hang (uitest's recorder
  holds the layout service): drive the app by coordinates or by hand.
- Prefer `id=` selectors in flows (give the components an `.id('...')`): they survive copy
  changes, `text=` does not.

## Performance: startup and jank

`oniro-app perf trace --launch --json` cold-starts the app under hitrace and reports
`startup.coldMs` (start request to first frame) and the frames that followed;
`perf trace --flow flow.json --json` measures the frames of a replayed flow: `frames.total`,
`janky` (frames longer than one refresh interval), `jankRate`, `p50Ms`/`p95Ms`/`maxMs`
and the `longest` ones. `--max-startup-ms <ms>` and `--max-jank-rate <r>` turn it into a
gate (exit 1 over the limit). `--hiperf` adds the hottest functions of the app's process.
A janky frame's usual cause is synchronous work on the UI thread (in `build()`, an item
builder, or an `onClick`): move it to `TaskPool` or precompute it.

## Emulators: one per parallel job

`oniro-app emulator start --instance <n> --wait-ready 180` boots pool instance n (1..99)
on its own copy-on-write disks, at hdc address `127.0.0.1:<55555+n>`, in about 15–25 s;
address it with `--device 127.0.0.1:<port>`. `emulator status --json` gives each instance's
health (`booting`, `ready`, `hdc-lost`, `stuck`, `stopped`); `emulator stop --instance n`
stops only that one, and `--fresh` on start discards its disks. A bare `emulator stop` stops
every emulator, pool included.

## Logs

- `oniro-app watch --log '<regex>' --for 5000` collects matching lines for a window.
- `oniro-app wait --log '<regex>' --timeout 30000 [--bundle <b>]` returns the moment a line
  matches ("did action X fire?").
- The whole session: start `oniro-app logs --clear -o hilog_full.txt` in the background
  *before* launching and stop it at the end (`--grep <regex>` keeps only matching lines).
  The device buffer holds 256 KB per type, and chatty components (ArkWeb) wrap it within
  seconds, so a dump taken at the end loses the launch.
- Fallback: `oniro-app hdc shell hilog -x | grep -E ...`.

## Raw device operations with no dedicated command

hdc is not on PATH: `oniro-app hdc <args>` runs the binary the CLI uses and adds `-t
$ONIRO_DEVICE_SERIAL` (or `--device`); `oniro-app hdc --path` prints where it is. hdc exits
0 even when it prints `[Fail]…`, so read the output.

- List targets: `oniro-app devices --long` (raw: `oniro-app hdc list targets -v`).
- Force-stop: `oniro-app app stop <bundle>`.
- Push and pull: `oniro-app file send <local> <remote>` / `oniro-app file recv <remote> <local>`.
- Set a system parameter: `oniro-app hdc shell param set <key> <value>`.
- Reboot: `oniro-app reboot` (see `ohos-system-dev` for reboot-to-reload).
- A photo in the gallery, for photo-picker flows: `oniro-app file send img.jpg
  /data/local/tmp/x.jpg`, then `oniro-app hdc shell mediatool send /data/local/tmp/x.jpg`.
  In the system picker, tapping a thumbnail opens a preview: tap its selection circle, then
  Done.

### Give the app a file (a model, a fixture, a database)

`oniro-app file send model.gguf files/models/model.gguf --bundle <bundle>` writes into the
app's sandbox and hands the file to the app's user. Relative paths resolve under
`/data/app/el2/100/base/<bundle>/`, which the app sees as `/data/storage/el2/base/`:
`files/…` is its application-level `filesDir`, `haps/entry/files/…` the entry module's.
Without `--bundle` the file stays root-owned and the app cannot read it.

### Windows

- **Git Bash rewrites device paths:** `/data/local/tmp/x` reaches the CLI as `C:/Program
  Files/Git/data/local/tmp/x`. Prefix such commands with `MSYS_NO_PATHCONV=1` (`file send`
  / `file recv` refuse a rewritten path and say so; `oniro-app hdc shell …` arguments are
  not checked), or run them from PowerShell.
- Local paths may use either slash; `file send` / `file recv` resolve them, 8.3 short names
  (`C:\Users\FRANCE~1\…`) included. Raw `hdc file send/recv` joins a forward-slash absolute
  path (`C:/Users/…`) onto the current directory and fails.
