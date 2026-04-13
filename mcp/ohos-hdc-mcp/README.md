# ohos-hdc-mcp

Stdio MCP server (Node.js) that wraps `hdc` as structured tools for Claude Code.

## Tools

- `list_devices` — connected targets
- `shell(command, timeout?)` — arbitrary shell
- `install_hap(path)` / `uninstall_app(bundle_name)`
- `start_app(bundle_name, ability_name)` / `stop_app(bundle_name)`
- `screenshot()` — returns a JPEG image Claude can analyze
- `get_logs(bundle_name?, lines?)` — `hilog -x` (optionally grep-filtered)
- `send_file(local, remote)` / `recv_file(remote, local)`
- `send_input(type, params)` — `click`, `doubleClick`, `longClick`, `swipe`, `drag`, `fling`, `keyEvent`, `inputText`
- `get_device_info()` — model, OS version, display dump

## Install

```bash
cd device/board/oniro/tools/ohos-hdc-mcp
npm install
```

Requires Node.js ≥18.

## Register with Claude Code

```bash
claude mcp add --transport stdio ohos-hdc -- \
  node /home/mrfrank/openharmony-6.1/device/board/oniro/tools/ohos-hdc-mcp/index.js
```

Or in `~/.claude.json`:

```json
{
  "mcpServers": {
    "ohos-hdc": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/mrfrank/openharmony-6.1/device/board/oniro/tools/ohos-hdc-mcp/index.js"],
      "env": {
        "HDC_PATH": "hdc",
        "DEVICE_SERIAL": "auto"
      }
    }
  }
}
```

## Notes

- Requires an active `hdc` connection.
- `send_input` coordinates are native display pixels (1:1 with `screenshot()` output).
- Set `DEVICE_SERIAL` if multiple devices are attached; `auto`/empty = default target.
