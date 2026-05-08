# ohos-hdc-mcp

Stdio MCP server (Node.js) that wraps `hdc` as structured tools for Claude Code.

## Tools

- `list_devices` — connected targets
- `shell(command, timeout?)` — arbitrary shell
- `install_hap(path)` / `uninstall_app(bundle_name)`
- `start_app(bundle_name, ability_name)` / `stop_app(bundle_name)`
- `screenshot(max_dim?)` — downscaled JPEG (default longest side 1024px) with a 10×10 grid overlay and X/Y axis labels (0.0–1.0)
- `get_logs(bundle_name?, grep?, lines?)` — `hilog -x` with optional bundle/regex filter
- `send_file(local, remote)` / `recv_file(remote, local)`
- `send_input(type, params)` — coordinates are **float percentages (0.0–1.0)** of the display, matching the screenshot grid. Types: `click`, `doubleClick`, `longClick`, `swipe`, `drag`, `fling`, `keyEvent`, `inputText`
- `dump_layout(bundle_name?, raw?)` — pruned UI tree from `uitest dumpLayout` with bounds and centers as 0.0–1.0; use to confirm what is at a coordinate before tapping
- `get_device_info()` — model, OS version, display dump

## Install

```bash
cd mcp/ohos-hdc-mcp
npm install
```

Requires Node.js ≥18.

## Register with Claude Code

```bash
claude mcp add --transport stdio ohos-hdc -- \
  node /path/to/agent-skills/mcp/ohos-hdc-mcp/index.js
```

Or in `~/.claude.json`:

```json
{
  "mcpServers": {
    "ohos-hdc": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/agent-skills/mcp/ohos-hdc-mcp/index.js"],
      "env": {
        "HDC_PATH": "hdc",
        "DEVICE_SERIAL": "auto"
      }
    }
  }
}
```

## Register with Codex

Configure `~/.codex/config.toml` (Linux/macOS) or `C:\Users\<username>\.codex\config.toml` (Windows). Example with Windows install paths (tested on Windows):

```toml
[mcp_servers.ohos-hdc]
command = "node"
args = ["C:\\Users\\username\\repos\\agent-skills\\mcp\\ohos-hdc-mcp\\index.js"]
cwd = "C:\\Users\\username\\repos\\agent-skills\\mcp\\ohos-hdc-mcp"
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 600

[mcp_servers.ohos-hdc.env]
HDC_PATH = "C:\\hdc_bin\\hdc.exe"
DEVICE_SERIAL = "auto"

[mcp_servers.ohos-hdc.tools.list_devices]
approval_mode = "approve"
```

## Notes

- Requires an active `hdc` connection.
- `send_input` takes **float percentages (0.0–1.0)**. The server converts to device pixels using a cached resolution (resolved on the first `screenshot` / `dump_layout` / `get_device_info` call, or via `hidumper`).
- `screenshot` returns a downscaled JPEG with a 10×10 grid and axis labels — combine with `dump_layout` to confirm the target before tapping.
- Set `DEVICE_SERIAL` if multiple devices are attached; `auto`/empty = default target.
