#!/usr/bin/env node
// OHOS HDC MCP server — wraps `hdc` as MCP tools for Claude Code.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const HDC = process.env.HDC_PATH || "hdc";
const DEVICE = process.env.DEVICE_SERIAL || "";

function hdc(args, { timeoutMs = 60_000 } = {}) {
  const argv = [];
  if (DEVICE && DEVICE !== "auto") argv.push("-t", DEVICE);
  argv.push(...args);
  return new Promise((resolve) => {
    const child = spawn(HDC, argv, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      stderr += `\n[timeout after ${timeoutMs}ms: ${HDC} ${argv.join(" ")}]`;
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(t);
      resolve({ code: 127, stdout: "", stderr: `${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

const sh = (command, opts) => hdc(["shell", command], opts);

function fmt({ code, stdout, stderr }) {
  const body = `${stdout || ""}${stderr || ""}`.trim();
  if (code === 0) return body || "ok";
  return `[exit ${code}]\n${body}`;
}

const text = (s) => ({ content: [{ type: "text", text: s }] });

const server = new McpServer({ name: "ohos-hdc", version: "0.1.0" });

server.registerTool(
  "list_devices",
  {
    title: "List devices",
    description: "List connected HDC devices (serials + status).",
    inputSchema: {},
  },
  async () => text(fmt(await hdc(["list", "targets", "-v"]))),
);

server.registerTool(
  "shell",
  {
    title: "Shell",
    description: "Run an arbitrary shell command on the device.",
    inputSchema: {
      command: z.string(),
      timeout: z.number().int().positive().optional(),
    },
  },
  async ({ command, timeout }) =>
    text(fmt(await sh(command, { timeoutMs: (timeout ?? 60) * 1000 }))),
);

server.registerTool(
  "install_hap",
  {
    title: "Install HAP",
    description: "Install a .hap file onto the device.",
    inputSchema: { path: z.string() },
  },
  async ({ path }) => text(fmt(await hdc(["install", path], { timeoutMs: 300_000 }))),
);

server.registerTool(
  "uninstall_app",
  {
    title: "Uninstall app",
    description: "Uninstall an app by bundle name.",
    inputSchema: { bundle_name: z.string() },
  },
  async ({ bundle_name }) => text(fmt(await hdc(["uninstall", bundle_name]))),
);

server.registerTool(
  "start_app",
  {
    title: "Start app",
    description: "Launch an ability inside a bundle (aa start).",
    inputSchema: { bundle_name: z.string(), ability_name: z.string() },
  },
  async ({ bundle_name, ability_name }) =>
    text(fmt(await sh(`aa start -a ${ability_name} -b ${bundle_name}`))),
);

server.registerTool(
  "stop_app",
  {
    title: "Stop app",
    description: "Force-stop an app (aa force-stop).",
    inputSchema: { bundle_name: z.string() },
  },
  async ({ bundle_name }) => text(fmt(await sh(`aa force-stop ${bundle_name}`))),
);

server.registerTool(
  "screenshot",
  {
    title: "Screenshot",
    description:
      "Capture the current screen via snapshot_display. Returns a JPEG image.",
    inputSchema: {},
  },
  async () => {
    const remote = "/data/local/tmp/mcp_screenshot.jpeg";
    const cap = await sh(`snapshot_display -f ${remote}`, { timeoutMs: 30_000 });
    if (cap.code !== 0) {
      return text(`snapshot_display failed: ${fmt(cap)}`);
    }
    const local = join(tmpdir(), `mcp_screen_${randomBytes(6).toString("hex")}.jpeg`);
    const pull = await hdc(["file", "recv", remote, local], { timeoutMs: 30_000 });
    if (pull.code !== 0) {
      return text(`file recv failed: ${fmt(pull)}`);
    }
    try {
      const data = await readFile(local);
      return {
        content: [
          {
            type: "image",
            data: data.toString("base64"),
            mimeType: "image/jpeg",
          },
        ],
      };
    } finally {
      unlink(local).catch(() => {});
    }
  },
);

server.registerTool(
  "get_logs",
  {
    title: "Get hilog",
    description:
      "Dump hilog (`hilog -x`). Optional bundle_name filter, grep regex filter, and lines cap.",
    inputSchema: {
      bundle_name: z.string().optional(),
      grep: z.string().optional(),
      lines: z.number().int().positive().optional(),
    },
  },
  async ({ bundle_name, grep, lines }) => {
    let pipe = "hilog -x";
    if (bundle_name) {
      const safe = bundle_name.replace(/'/g, `'\\''`);
      const pidRes = await sh(`pidof '${safe}'`, { timeoutMs: 10_000 });
      const pids = (pidRes.stdout || "").trim().split(/\s+/).filter(Boolean);
      if (pids.length === 0) {
        return text(`[no running process for bundle '${bundle_name}']`);
      }
      const alt = pids.map((p) => `\\b${p}\\b`).join("|");
      pipe += ` | grep -E '${alt}'`;
    }
    if (grep) {
      const safeGrep = grep.replace(/'/g, `'\\''`);
      pipe += ` | grep -E '${safeGrep}'`;
    }
    if (lines && lines > 0) pipe += ` | tail -n ${Math.floor(lines)}`;
    return text(fmt(await sh(pipe, { timeoutMs: 30_000 })));
  },
);

server.registerTool(
  "send_file",
  {
    title: "Send file",
    description: "Push a local file to the device (hdc file send).",
    inputSchema: { local: z.string(), remote: z.string() },
  },
  async ({ local, remote }) =>
    text(fmt(await hdc(["file", "send", local, remote], { timeoutMs: 600_000 }))),
);

server.registerTool(
  "recv_file",
  {
    title: "Receive file",
    description: "Pull a file from the device (hdc file recv).",
    inputSchema: { remote: z.string(), local: z.string() },
  },
  async ({ remote, local }) =>
    text(fmt(await hdc(["file", "recv", remote, local], { timeoutMs: 600_000 }))),
);

server.registerTool(
  "send_input",
  {
    title: "Send input",
    description:
      "Inject UI input via uitest uiInput. type: click|doubleClick|longClick|swipe|drag|fling|keyEvent|inputText. " +
      "click/doubleClick/longClick params: {x, y}. " +
      "swipe/drag/fling params: {startX, startY, endX, endY, speed?} (aliases: x1/y1/x2/y2, velocity). " +
      "keyEvent params: {keyID} (alias: key). " +
      "inputText params: {text}.",
    inputSchema: {
      type: z.enum([
        "click",
        "doubleClick",
        "longClick",
        "swipe",
        "drag",
        "fling",
        "keyEvent",
        "inputText",
      ]),
      params: z.record(z.any()),
    },
  },
  async ({ type, params }) => {
    const p = params || {};
    let cmd;
    switch (type) {
      case "click":
      case "doubleClick":
      case "longClick":
        cmd = `uitest uiInput ${type} ${+p.x} ${+p.y}`;
        break;
      case "swipe":
      case "drag":
      case "fling": {
        const x1 = p.x1 ?? p.startX;
        const y1 = p.y1 ?? p.startY;
        const x2 = p.x2 ?? p.endX;
        const y2 = p.y2 ?? p.endY;
        const speed = p.velocity ?? p.speed;
        const vel = speed ? ` ${+speed}` : "";
        cmd = `uitest uiInput ${type} ${+x1} ${+y1} ${+x2} ${+y2}${vel}`;
        break;
      }
      case "keyEvent":
        cmd = `uitest uiInput keyEvent ${p.key ?? p.keyID}`;
        break;
      case "inputText": {
        const t = String(p.text ?? "").replace(/'/g, `'\\''`);
        cmd = `uitest uiInput inputText '${t}'`;
        break;
      }
    }
    return text(fmt(await sh(cmd)));
  },
);

server.registerTool(
  "get_device_info",
  {
    title: "Device info",
    description:
      "Return device model, manufacturer, OS version, and display dump (JSON).",
    inputSchema: {},
  },
  async () => {
    const props = [
      ["model", "const.product.model"],
      ["manufacturer", "const.product.manufacturer"],
      ["brand", "const.product.brand"],
      ["os_full_name", "const.ohos.fullname"],
      ["os_release_type", "const.ohos.releasetype"],
      ["sdk_api_version", "const.ohos.apiversion"],
      ["build_version", "const.product.software.version"],
    ];
    const info = {};
    for (const [key, prop] of props) {
      const r = await sh(`param get ${prop}`, { timeoutMs: 10_000 });
      info[key] = r.code === 0 ? r.stdout.trim() : "";
    }
    const disp = await sh("hidumper -s 10 -a screen", { timeoutMs: 10_000 });
    if (disp.code === 0) info.display_dump = disp.stdout.trim().slice(0, 800);
    return text(JSON.stringify(info, null, 2));
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
