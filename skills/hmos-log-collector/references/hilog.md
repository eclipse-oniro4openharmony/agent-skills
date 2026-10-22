# HiLog Collection

HiLog is the primary structured log source for application and system events.
Options vary with device images and SDK releases, so record the command and exit
status rather than assuming every filter is supported.

- Prefer a bounded time window.
- Keep the original command in `manifest.json`.
- Filter by package, PID, tag, and level only when known.
- Capture a small post-failure window for asynchronous crash messages.
- Preserve stderr separately when a filter is rejected.
- `-x` / `--exit` is a boolean option on current images. Use `hilog -x` for a
  non-blocking buffer snapshot; do not append a duration value.
- If snapshot collection fails and `devecocli` is available, retry with its
  package/time-window query and preserve both records.

Missing log lines do not prove that an event did not happen; buffers, filters,
rate limits, and device policies affect visibility.
