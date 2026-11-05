# Seeing and driving the UI on the device

The `oniro-app` commands that look at the screen and act on it, in the detail `SKILL.md`
leaves out. All of them auto-resolve the device (`ONIRO_DEVICE_SERIAL` or `--device` when
several are connected).

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
- Fallback: `hdc shell hilog -x | grep -E ...`.

## Raw device operations with no dedicated command

- List targets: `hdc list targets -v`.
- Force-stop: `oniro-app app stop <bundle>` (or `hdc shell aa force-stop <bundle>`).
- Push and pull: `oniro-app file send <local> <remote>` / `oniro-app file recv <remote> <local>`.
- Set a system parameter: `hdc shell param set <key> <value>`.
- Reboot: `oniro-app reboot` (see `ohos-system-dev` for reboot-to-reload).
- A photo in the gallery, for photo-picker flows: `oniro-app file send img.jpg
  /data/local/tmp/x.jpg`, then `hdc shell mediatool send /data/local/tmp/x.jpg`. In the
  system picker, tapping a thumbnail opens a preview: tap its selection circle, then Done.
