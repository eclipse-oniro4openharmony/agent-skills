# Crashes, freezes and faultlogs

When an app dies or hangs, hiview writes a **faultlog** on the device a few seconds later.
`oniro-app logs crash` fetches the newest one, classifies it and points at the line of
project code it came from. Read that before the hilog: the faultlog has the error, the
stack and the thread that hung, and the hilog often does not.

## Steps

1. Reproduce: `oniro-app app launch --smoke` (or the flow that crashes). `--smoke` exits 1
   when the process died, a crash was recorded or the screen is blank, and puts the crash
   in `smoke.crash`.
2. Read the fault: `oniro-app logs crash --wait 15000 --json` (defaults to the project's
   bundle; `--bundle <b>` otherwise, `--since 120` for the last two minutes). Exit 0 either
   way: read `crashed`.
3. Act on `kind`:

| `kind` | What it is | Where to look | Usual fix |
| --- | --- | --- | --- |
| `js_crash` | An uncaught ArkTS exception | `jsError.name`, `jsError.message`, `file`:`line` (the first project frame) | Handle the error or fix the value; a `TypeError` "cannot read property of undefined" is usually state read before it is set |
| `cpp_crash` | A native signal (`SIGSEGV`, `SIGABRT`) | `reason`, `nativeFrames` (the app's `libentry.so` frames), `projectFrame` (the ArkTS call into it) | Null or freed pointer in the Node-API code; a `napi_value` used after its call or from another thread (see [`arkui-v2-state.md`](./arkui-v2-state.md#node-api-the-nativecpp-template)) |
| `app_freeze` | The main thread blocked (`THREAD_BLOCK_6S`, `APP_INPUT_BLOCK`) | `subtype`, `stack` of the main thread, `binderChain` when it waits on a service | Move the work off the UI thread (`TaskPool`, `async`), or remove the synchronous IPC |
| `sample_stack` | A sampled stack, not a crash | `stack` | Usually performance, not a bug |

`confidence` (`high`, `medium`, `low`) says how sure the classification is. For an
`app_freeze`, the frame can point into the compiled `.ts` (`Index.ts:49:25`) rather than the
`.ets` source; find the function by name.

4. Fix, then run step 1 again until `--smoke` passes, and add a test that exercises the path
   (see [`testing.md`](./testing.md)).

`logs crash --path <file>` reads a faultlog you already have, with no device. `-o <dir>`
keeps the fetched faultlog (`rawPath` in the JSON).

## Without `logs crash` (oniro-app before 0.18)

```
hdc shell hidumper -s 1201 -a '-p Faultlogger -LogSuffixWithMs'      # list, newest first
hdc shell hidumper -s 1201 -a '-p Faultlogger -f <name>'             # print one
hdc shell ls /data/log/faultlog/faultlogger/                         # the same files
```

Pull one with `oniro-app file recv /data/log/faultlog/faultlogger/<name> .`, and read its
`Reason`, `Error name`, `Error message` and `Stacktrace` (or `Fault thread info` for a
native crash). `oniro-app logs collect` bundles hilog and faultlog evidence for a report.
On some builds an app's native crash leaves no faultlog, only a crash record in
`/data/log/faultlog/temp/cppcrash-<pid>-<ms>.json` (readable as root); `logs crash` reads
those too.
