#!/usr/bin/env bash
set -u

PACKAGE=""
PID=""
DEVICE=""
TAG=""
LEVEL=""
DURATION=600
OUTPUT="./incident-bundles"
REDACT=0

usage() {
  echo "Usage: $0 [--package NAME] [--pid PID] [--device ID] [--tag TAG] [--level LEVEL] [--duration SECONDS] [--output DIR] [--redact]"
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --package) PACKAGE="$2"; shift 2 ;;
    --pid) PID="$2"; shift 2 ;;
    --device) DEVICE="$2"; shift 2 ;;
    --tag) TAG="$2"; shift 2 ;;
    --level) LEVEL="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --redact) REDACT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done
if ! command -v hdc >/dev/null 2>&1; then
  echo "hdc was not found on PATH. Install or configure the HarmonyOS device toolchain first." >&2
  exit 1
fi
mkdir -p "$OUTPUT"
STAMP=$(date -u +%Y%m%d-%H%M%S)
BUNDLE="$OUTPUT/incident-$STAMP"
mkdir -p "$BUNDLE/logs" "$BUNDLE/device"
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMANDS="$BUNDLE/.commands.jsonl"
: > "$COMMANDS"

run_command() {
  local name="$1"; shift
  local output="$1"; shift
  local executable="hdc" inspect_output=1
  if [ "${1:-}" = "--executable" ]; then executable="$2"; shift 2; fi
  if [ "${1:-}" = "--no-content-check" ]; then inspect_output=0; shift; fi
  local target="$BUNDLE/$output" stderr_rel="$output.stderr.txt" code error="" status="success"
  local stderr_target="$BUNDLE/$stderr_rel"
  "$executable" "$@" >"$target" 2>"$stderr_target" || code=$?
  code=${code:-0}
  if [ "$code" -ne 0 ]; then
    error="$executable exited with code $code"
  elif [ "$inspect_output" -eq 1 ] && grep -Eiq 'permission denied|too many arguments|unknown option|invalid option|command not found' "$target" "$stderr_target" 2>/dev/null; then
    error="collector output indicates failure"
  fi
  if [ -n "$error" ]; then status="failed"; fi
  if [ ! -s "$stderr_target" ]; then rm -f "$stderr_target"; stderr_rel=""; fi
  python3 - "$COMMANDS" "$name" "$executable $*" "$status" "$output" "$stderr_rel" "$code" "$error" <<'PY'
import json, sys
from pathlib import Path
path, name, command, status, output, stderr, code, error = sys.argv[1:]
row = {"name": name, "command": command, "status": status, "output": output,
       "stderr": stderr or None, "exitCode": int(code), "error": error or None}
with Path(path).open("a", encoding="utf-8") as stream:
    stream.write(json.dumps(row) + "\n")
PY
}

run_command list-targets device/targets.txt list targets
SHELL_PREFIX=(shell)
if [ -n "$DEVICE" ]; then SHELL_PREFIX=(-t "$DEVICE" shell); fi
run_command device-name device/device-info.txt "${SHELL_PREFIX[@]}" param get const.product.name
run_command process-list device/process-list.txt "${SHELL_PREFIX[@]}" ps -ef
run_command memory device/memory.txt "${SHELL_PREFIX[@]}" hidumper --mem
run_command threads device/threads.txt "${SHELL_PREFIX[@]}" hidumper -p
run_command hidumper device/hidumper.txt "${SHELL_PREFIX[@]}" hidumper -s AbilityManagerService
run_command hilog-snapshot logs/hilog.txt "${SHELL_PREFIX[@]}" hilog -x
FAULT_ARGS=("${SHELL_PREFIX[@]}" hidumper -e --list -n 20)
if [ -n "$PACKAGE" ]; then FAULT_ARGS=("${SHELL_PREFIX[@]}" hidumper -e --print "$PACKAGE" -n 5); fi
run_command faultlog logs/faultlog.txt --no-content-check "${FAULT_ARGS[@]}"
if command -v devecocli >/dev/null 2>&1; then
  CRASH_ARGS=(log --crash)
  if [ -n "$PACKAGE" ]; then CRASH_ARGS+=(--bundle-name "$PACKAGE"); fi
  if [ -n "$DEVICE" ]; then CRASH_ARGS+=(--device "$DEVICE"); fi
  run_command devecocli-crash-log logs/crashlog.txt --executable devecocli --no-content-check "${CRASH_ARGS[@]}"
else
  printf '%s\n' '{"name":"devecocli-crash-log","command":"devecocli log --crash","status":"unavailable","output":null,"stderr":null,"exitCode":null,"error":"devecocli was not found on PATH"}' >> "$COMMANDS"
fi
if [ -n "$TAG" ] || [ -n "$LEVEL" ]; then
  python3 - "$BUNDLE/logs/hilog.txt" "$TAG" "$LEVEL" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1]); tag, level = sys.argv[2:]
if path.exists():
    rows = path.read_text(encoding="utf-8", errors="replace").splitlines()
    path.write_text("\n".join(x for x in rows if (not tag or tag in x) and (not level or level in x)) + "\n", encoding="utf-8")
PY
fi
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
python3 - "$BUNDLE/manifest.json" "$COMMANDS" "$START" "$END" "$PACKAGE" "$PID" "$DEVICE" "$TAG" "$LEVEL" "$DURATION" "$REDACT" <<'PY'
import json, sys
from pathlib import Path
manifest_path, commands_path, start, end, package, pid, device, tag, level, duration, redact = sys.argv[1:]
data = {"schemaVersion":"1.0", "collectorVersion":"0.3.0", "collectionStartUtc":start,
        "collectionEndUtc":end, "host":{"os":"POSIX"}, "target":device,
        "packageName":package, "pid":pid, "filters":{"tag":tag,"level":level,"durationSeconds":int(duration)},
        "redactionRequested":redact == "1", "redactionStatus":"requested" if redact == "1" else "not-requested",
        "archiveStatus":{"status":"pending","path":None},
        "commands":[json.loads(x) for x in Path(commands_path).read_text().splitlines()],
        "notes":["The collector is read-only on the target device.","Command availability varies by device image and privilege level."]}
Path(manifest_path).write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY
printf '%s\n' 'Add reproduction steps and precise event timestamps here.' > "$BUNDLE/notes.txt"
rm -f "$COMMANDS"
ARCHIVE_SOURCE="$BUNDLE"
if [ "$REDACT" -eq 1 ]; then
  python3 "$(dirname "$0")/redact_logs.py" --input "$BUNDLE" --output "$BUNDLE-redacted"
  ARCHIVE_SOURCE="$BUNDLE-redacted"
fi
ARCHIVE_PATH="$ARCHIVE_SOURCE.zip"
python3 - "$ARCHIVE_SOURCE" "$ARCHIVE_PATH" <<'PY'
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
source = Path(sys.argv[1])
with ZipFile(sys.argv[2], "w", ZIP_DEFLATED) as archive:
    for item in source.rglob("*"):
        if item.is_file(): archive.write(item, item.relative_to(source))
PY
python3 - "$BUNDLE/manifest.json" "$BUNDLE-redacted/manifest.json" "$REDACT" "$(basename "$ARCHIVE_PATH")" <<'PY'
import json, sys
from pathlib import Path
raw_path, redacted_path, redact, archive_name = sys.argv[1:]
for value in (raw_path, redacted_path if redact == "1" else None):
    if value:
        path = Path(value); data = json.loads(path.read_text(encoding="utf-8"))
        data["redactionStatus"] = "success" if redact == "1" else "not-requested"
        data["archiveStatus"] = {"status":"success","path":archive_name}
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY
python3 - "$ARCHIVE_SOURCE" "$ARCHIVE_PATH" <<'PY'
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
source = Path(sys.argv[1])
with ZipFile(sys.argv[2], "w", ZIP_DEFLATED) as archive:
    for item in source.rglob("*"):
        if item.is_file(): archive.write(item, item.relative_to(source))
PY
echo "$BUNDLE"
