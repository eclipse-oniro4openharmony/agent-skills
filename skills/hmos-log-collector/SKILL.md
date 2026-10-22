---
name: hmos-log-collector
description: Collects HarmonyOS and OpenHarmony device logs into a timestamped, redacted incident evidence bundle. Use when the user says grab logs, collect HiLog, collect faultlog, use hidumper, capture a crash scene, reproduce and collect logs, or needs logs prepared for JS crash, C++ crash, freeze, or memory analysis.
license: MIT
compatibility: Requires hdc for device collection; PowerShell 5.1+ on Windows or Bash and Python 3.9+ on Unix-like systems. Collection is read-only on the target device.
metadata:
  category: diagnostics
  platform: HarmonyOS/OpenHarmony
  identifier: hmos-log-collector
---

# HMOS Log Collector

Collect a reproducible diagnostic evidence bundle from a HarmonyOS or OpenHarmony
device or emulator. This skill is a collection and packaging workflow. It does
not diagnose the root cause and must not replace the specialized JS crash, C++
crash, freeze, or memory-analysis skills.

## Trigger Conditions

Use for grabbing/exporting HiLog, collecting application/system/fault logs,
collecting `hidumper` output, reproducing an issue and capturing device state,
capturing startup failure/crash/freeze evidence, filtering logs, or preparing a
sanitized incident ZIP for another diagnostic skill. Do not use it as the
primary skill for interpreting an existing crash or memory report.

## Safety Rules

1. Confirm the target device with `hdc list targets`.
2. Treat collected data as sensitive and store bundles outside app source unless
   explicitly requested otherwise.
3. Never print raw tokens, cookies, passwords, authorization headers, or full
   personal identifiers in the response.
4. Redact before sharing or uploading. Review the result manually; redaction is
   heuristic, not a security boundary.
5. Do not install packages, change device settings, clear logs, kill unrelated
   processes, or reboot the device as part of collection.
6. Treat non-zero exit codes, stderr, and recognizable command errors as
   collection failures even when `hdc` returns exit code 0; record them in the
   manifest.
7. Use `devecocli log --crash` as supplemental evidence when available.
8. If a command is unavailable or fails, record that and continue with
   independent collectors.
9. Use an explicit time window; default to the last 10 minutes when unspecified
   and state that default in the report.

## Workflow

1. Establish device selector, package, PID, time window, tag/level filters,
   reproduction steps, and output directory. Do not guess an unknown package.
2. Check `hdc list targets`, `hdc -v`, and the Python version. Use
   `scripts/collect_logs.ps1` on Windows or `scripts/collect_logs.sh` on Linux
   or macOS.
3. Run collection, for example:

   ```powershell
   pwsh -File scripts/collect_logs.ps1 -PackageName com.example.app -DurationSeconds 600 -OutputDirectory .\incident-bundles -Redact
   ```

   ```bash
   bash scripts/collect_logs.sh --package com.example.app --duration 600 --output ./incident-bundles --redact
   ```

4. Reproduce only the requested issue, note actions and timestamps, and stop
   collection promptly after the failure. Never clear pre-existing evidence.
5. Verify `manifest.json`, output paths, command statuses, timestamps, and
   redaction/archive status. Missing device capabilities must remain recorded.
6. Share only the reviewed redacted archive. Keep the original bundle private.
7. Route the bundle to the relevant JS crash, C++ crash, freeze, or memory
   analysis workflow. Do not infer root cause from collection output alone.

## Evidence Contract

Every collection should include a manifest with schema and collector versions,
UTC start/end times, host OS, device/package/PID where available, requested
filters, one status per command, relative output paths, redaction status, and
archive status. Do not put raw logs or secrets in the manifest.

## Failure Handling

- No device: report the `hdc` discovery result; do not claim device logs were collected.
- Multiple devices: ask for a selector unless the user supplied one.
- Permission denied: preserve the failure and continue with non-privileged evidence.
- Missing faultlog or `hidumper`: record as unavailable and retain other evidence.
- Redaction uncertainty or failure: mark the bundle unsafe to share.

## Included Resources

- `references/hilog.md`, `references/hidumper.md`, `references/faultlog.md`, and
  `references/log-redaction.md`: collection and review guidance.
- `scripts/collect_logs.ps1` and `scripts/collect_logs.sh`: platform collectors.
- `scripts/redact_logs.py`: cross-platform text redactor.
