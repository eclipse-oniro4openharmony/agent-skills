# HMOS Log Collector

Read-only diagnostic collection for HarmonyOS and OpenHarmony devices. The
collector gathers HiLog, fault/crash evidence, and device snapshots into a
timestamped incident bundle, records failures in `manifest.json`, redacts text,
and creates an archive.

Confirm the target first with `hdc list targets`. Store bundles outside the
application source tree and share only a reviewed redacted archive.

## Windows

```powershell
pwsh -File scripts/collect_logs.ps1 `
  -PackageName com.example.app `
  -Device DEVICE_SERIAL `
  -DurationSeconds 600 `
  -OutputDirectory .\incident-bundles `
  -Redact
```

## Linux or macOS

```bash
bash scripts/collect_logs.sh \
  --package com.example.app \
  --device DEVICE_SERIAL \
  --duration 600 \
  --output ./incident-bundles \
  --redact
```

The redactor is heuristic, not a security boundary. Inspect the output before
sharing it and keep the original bundle private.
