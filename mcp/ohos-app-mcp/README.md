# ohos-app-mcp

Stdio MCP server (Node.js) wrapping the OpenHarmony/HarmonyOS **app development** toolchain (`ohpm`, `codelinter`, `hvigorw`) plus deploy via `hdc`.

Pairs with [`ohos-hdc-mcp`](../ohos-hdc-mcp) (device runtime: shell, input, logs, screenshots).

## Tools

- `ohpm_install(project_path?)` — `ohpm install --all` (required before building)
- `codelinter(project_path?, args?)` — static analysis
- `build_hap(project_path?, mode?, tasks?, extra_args?)` — `hvigorw assembleHap`; auto-runs `ohpm install --all` if `oh_modules` is missing; lists generated `*-signed.hap` / `*-unsigned.hap`
- `clean(project_path?)` — `hvigorw clean`
- `list_haps(project_path?)` — list built HAPs under the project
- `deploy(project_path?, hap_path?, replace?)` — `hdc install` of the most recent signed HAP

## Install

```bash
cd ohos-app-mcp
npm install
```

Requires Node.js ≥18 and `ohpm`, `hvigorw` (project-local wrapper), `codelinter`, `hdc` on PATH.

## Register with Claude Code

```bash
claude mcp add --transport stdio ohos-app -- \
  node /path/to/agent-skills/mcp/ohos-app-mcp/index.js
```

Or in `~/.claude.json`:

```json
{
  "mcpServers": {
    "ohos-app": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/agent-skills/mcp/ohos-app-mcp/index.js"],
      "env": {
        "OHOS_PROJECT_PATH": "/path/to/your/app",
        "OHPM_PATH": "ohpm",
        "HVIGORW_PATH": "hvigorw",
        "CODELINTER_PATH": "codelinter",
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
[mcp_servers.ohos-app]
command = "node"
args = ["C:\\Users\\username\\repos\\agent-skills\\mcp\\ohos-app-mcp\\index.js"]
cwd = "C:\\Users\\username\\repos\\agent-skills\\mcp\\ohos-app-mcp"
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 600

[mcp_servers.ohos-app.env]
OHOS_PROJECT_PATH = "C:\\Users\\username\\repos\\my-app"
OHPM_PATH = "ohpm"
HVIGORW_PATH = "hvigorw"
CODELINTER_PATH = "codelinter"
HDC_PATH = "C:\\hdc_bin\\hdc.exe"
DEVICE_SERIAL = "auto"
```

## Notes

- `OHOS_PROJECT_PATH` provides the default project; per-call `project_path` overrides it.
- Signing must be configured in `build-profile.json5`. Without it, only `*-unsigned.hap` is produced and most devices will reject install — `deploy` surfaces this and refuses.
- `hvigorw` is invoked via the project-local wrapper script (`./hvigorw`), so the project's pinned hvigor version is used.
