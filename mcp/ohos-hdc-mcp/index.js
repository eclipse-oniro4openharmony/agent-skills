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
import sharp from "sharp";

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

// ---- Display dimensions (cached) ----
let cachedDisplay = null; // { width, height }

async function getDisplaySize() {
  if (cachedDisplay) return cachedDisplay;
  const r = await sh("hidumper -s 10 -a screen", { timeoutMs: 10_000 });
  if (r.code === 0) {
    const m = r.stdout.match(/render resolution=(\d+)x(\d+)/);
    if (m) {
      cachedDisplay = { width: +m[1], height: +m[2] };
      return cachedDisplay;
    }
  }
  return null;
}

function pctToPx({ width, height }, fx, fy) {
  const x = Math.round(Math.max(0, Math.min(1, fx)) * (width - 1));
  const y = Math.round(Math.max(0, Math.min(1, fy)) * (height - 1));
  return [x, y];
}

// ---- Screenshot grid overlay ----
function buildGridSvg(width, height) {
  const lineColor = "rgba(255,80,80,0.55)";
  const labelBg = "rgba(0,0,0,0.7)";
  const labelFg = "#fff";
  const fontSize = Math.max(10, Math.round(Math.min(width, height) / 60));
  const padding = Math.round(fontSize * 0.4);
  const labels = [];
  const lines = [];
  for (let i = 0; i <= 10; i++) {
    const f = i / 10;
    const x = Math.round(f * (width - 1));
    const y = Math.round(f * (height - 1));
    // grid lines (skip 0 and 10 — those are the image edges)
    if (i > 0 && i < 10) {
      lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${lineColor}" stroke-width="1"/>`);
      lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${lineColor}" stroke-width="1"/>`);
    }
    const tag = f.toFixed(1);
    // X-axis labels along the top
    const tx = i === 0 ? padding : i === 10 ? width - padding : x;
    const anchorX = i === 0 ? "start" : i === 10 ? "end" : "middle";
    labels.push(
      `<text x="${tx}" y="${fontSize + padding}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${labelFg}" stroke="${labelBg}" stroke-width="3" paint-order="stroke" text-anchor="${anchorX}">${tag}</text>`,
    );
    // Y-axis labels along the left
    const ty = i === 0 ? fontSize + padding : i === 10 ? height - padding : y + fontSize / 3;
    labels.push(
      `<text x="${padding}" y="${ty}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${labelFg}" stroke="${labelBg}" stroke-width="3" paint-order="stroke" text-anchor="start">${tag}</text>`,
    );
  }
  // Axis title markers in the corners
  labels.push(
    `<text x="${width / 2}" y="${fontSize * 2.4 + padding}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${labelFg}" stroke="${labelBg}" stroke-width="3" paint-order="stroke" text-anchor="middle">X →</text>`,
  );
  labels.push(
    `<text x="${padding}" y="${fontSize * 2.6 + padding}" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="${labelFg}" stroke="${labelBg}" stroke-width="3" paint-order="stroke" text-anchor="start">Y ↓</text>`,
  );
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join("")}${labels.join("")}</svg>`;
}

async function renderScreenshot(buf, maxDim) {
  const meta = await sharp(buf).metadata();
  const longest = Math.max(meta.width, meta.height);
  const scale = Math.min(1, maxDim / longest);
  const outW = Math.max(1, Math.round(meta.width * scale));
  const outH = Math.max(1, Math.round(meta.height * scale));
  const resized = await sharp(buf).resize(outW, outH).jpeg({ quality: 80 }).toBuffer();
  const svg = buildGridSvg(outW, outH);
  const composited = await sharp(resized)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 80 })
    .toBuffer();
  return { buf: composited, width: outW, height: outH, originalWidth: meta.width, originalHeight: meta.height };
}

// ---- Layout dump filtering ----
function parseBounds(s) {
  // Format: "[x1,y1][x2,y2]"
  const m = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(s || "");
  if (!m) return null;
  return [+m[1], +m[2], +m[3], +m[4]];
}

// Container types that almost never carry useful info on their own.
const STRUCTURAL_TYPES = new Set([
  "Stack", "Column", "Row", "Flex", "__Common__", "Grid", "GridItem",
  "List", "ListItem", "Scroll", "Swiper", "SwiperContent", "Navigator",
  "Tabs", "TabContent", "RelativeContainer", "WaterFlow", "FlowItem",
]);

function pruneNode(node, display) {
  const a = node.attributes || {};
  const px = parseBounds(a.bounds);
  const out = {};
  if (px && display) {
    const w = display.width || 1;
    const h = display.height || 1;
    out.b = [
      +(px[0] / w).toFixed(3),
      +(px[1] / h).toFixed(3),
      +(px[2] / w).toFixed(3),
      +(px[3] / h).toFixed(3),
    ];
    out.c = [
      +(((px[0] + px[2]) / 2) / w).toFixed(3),
      +(((px[1] + px[3]) / 2) / h).toFixed(3),
    ];
  }
  if (a.type && !STRUCTURAL_TYPES.has(a.type)) out.type = a.type;
  if (a.text) out.text = a.text;
  if (a.description) out.desc = a.description;
  if (a.id) out.id = a.id;
  if (a.key && a.key !== a.id) out.key = a.key;
  if (a.bundleName) out.bundle = a.bundleName;
  for (const [k, short] of [
    ["clickable", "click"],
    ["checkable", "check"],
    ["checked", "checked"],
    ["selected", "sel"],
    ["focused", "focus"],
    ["scrollable", "scroll"],
    ["longClickable", "longClick"],
  ]) {
    if (a[k] === "true") out[short] = true;
  }

  const children = [];
  for (const c of node.children || []) {
    const pc = pruneNode(c, display);
    if (pc) {
      if (Array.isArray(pc)) children.push(...pc);
      else children.push(pc);
    }
  }

  const hasSignal = Boolean(
    out.text || out.desc || out.id || out.key || out.click ||
    out.scroll || out.check || out.longClick || out.bundle ||
    (out.type && out.type !== "root"),
  );

  if (!hasSignal && children.length === 0) return null;
  // Collapse structural wrappers: pass children up to the parent.
  if (!hasSignal) return children.length === 1 ? children[0] : children;

  if (children.length) out.children = children;
  return out;
}

const server = new McpServer({ name: "ohos-hdc", version: "0.2.0" });

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
      "Capture the screen, downscale to save tokens, and overlay a 10x10 grid with X/Y axis labels (0.0–1.0). " +
      "Returns the annotated JPEG plus a text note with the original and rendered dimensions. " +
      "Use the gridlines to pick float percentage coordinates for `send_input`. " +
      "Optional `max_dim` (default 1024): max pixels of the longest side after downscale.",
    inputSchema: {
      max_dim: z.number().int().min(256).max(4096).optional(),
    },
  },
  async ({ max_dim }) => {
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
      const raw = await readFile(local);
      const rendered = await renderScreenshot(raw, max_dim ?? 1024);
      // Cache display dims from the source screenshot so send_input doesn't need hidumper.
      cachedDisplay = { width: rendered.originalWidth, height: rendered.originalHeight };
      return {
        content: [
          {
            type: "text",
            text:
              `Device resolution: ${rendered.originalWidth}x${rendered.originalHeight}px. ` +
              `Image rendered at ${rendered.width}x${rendered.height}px with a 10x10 grid (axes labeled 0.0–1.0). ` +
              `Use float percentage coordinates with send_input.`,
          },
          {
            type: "image",
            data: rendered.buf.toString("base64"),
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
      "Inject UI input via uitest uiInput. Coordinates are FLOAT PERCENTAGES (0.0–1.0) of the display, " +
      "matching the grid drawn over screenshots. They are converted to device pixels using the cached " +
      "display resolution. type: click|doubleClick|longClick|swipe|drag|fling|keyEvent|inputText. " +
      "click/doubleClick/longClick params: {x, y}. " +
      "swipe/drag/fling params: {startX, startY, endX, endY, speed?} (aliases: x1/y1/x2/y2, velocity). " +
      "keyEvent params: {keyID} (alias: key; or symbolic Back/Home/Power). " +
      "inputText params: {text, x?, y?} — if x/y are given, taps then types; otherwise types into the focused field.",
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
    const display = await getDisplaySize();
    if (!display && type !== "keyEvent") {
      return text(
        "[error] could not resolve device display resolution. Run `screenshot` once first, or check that hidumper is available.",
      );
    }
    let cmd;
    switch (type) {
      case "click":
      case "doubleClick":
      case "longClick": {
        const [x, y] = pctToPx(display, +p.x, +p.y);
        cmd = `uitest uiInput ${type} ${x} ${y}`;
        break;
      }
      case "swipe":
      case "drag":
      case "fling": {
        const fx1 = p.x1 ?? p.startX;
        const fy1 = p.y1 ?? p.startY;
        const fx2 = p.x2 ?? p.endX;
        const fy2 = p.y2 ?? p.endY;
        const [x1, y1] = pctToPx(display, +fx1, +fy1);
        const [x2, y2] = pctToPx(display, +fx2, +fy2);
        const speed = p.velocity ?? p.speed;
        const vel = speed ? ` ${+speed}` : "";
        cmd = `uitest uiInput ${type} ${x1} ${y1} ${x2} ${y2}${vel}`;
        break;
      }
      case "keyEvent":
        cmd = `uitest uiInput keyEvent ${p.key ?? p.keyID}`;
        break;
      case "inputText": {
        const t = String(p.text ?? "").replace(/'/g, `'\\''`);
        if (p.x != null && p.y != null) {
          const [x, y] = pctToPx(display, +p.x, +p.y);
          cmd = `uitest uiInput inputText ${x} ${y} '${t}'`;
        } else {
          cmd = `uitest uiInput text '${t}'`;
        }
        break;
      }
    }
    return text(fmt(await sh(cmd)));
  },
);

server.registerTool(
  "dump_layout",
  {
    title: "Dump UI layout",
    description:
      "Dump the current on-screen layout via `uitest dumpLayout` and return a compact, pruned tree. " +
      "Each node has `b` = bounds [x1,y1,x2,y2] and `c` = center [x,y], all as 0.0–1.0 percentages of " +
      "the display (matches the screenshot grid). Nodes carry text, description (`desc`), id, key, type, " +
      "and interactive flags (click, scroll, check, sel, focus, longClick) when present. Pass the `c` " +
      "of the target straight to `send_input click` to tap reliably. Optional `bundle_name` filters to a " +
      "single window. `raw=true` returns the unfiltered JSON instead.",
    inputSchema: {
      bundle_name: z.string().optional(),
      raw: z.boolean().optional(),
    },
  },
  async ({ bundle_name, raw }) => {
    const args = [];
    if (bundle_name) {
      const safe = bundle_name.replace(/'/g, `'\\''`);
      args.push(`-b '${safe}'`);
    }
    const dump = await sh(`uitest dumpLayout ${args.join(" ")}`.trim(), { timeoutMs: 30_000 });
    if (dump.code !== 0) return text(`dumpLayout failed: ${fmt(dump)}`);
    const m = dump.stdout.match(/saved to:\s*(\S+)/i);
    if (!m) return text(`could not parse dumpLayout output:\n${dump.stdout}`);
    const remote = m[1];
    const local = join(tmpdir(), `mcp_layout_${randomBytes(6).toString("hex")}.json`);
    const pull = await hdc(["file", "recv", remote, local], { timeoutMs: 30_000 });
    if (pull.code !== 0) return text(`file recv failed: ${fmt(pull)}`);
    try {
      const data = await readFile(local, "utf8");
      sh(`rm -f ${remote}`).catch(() => {});
      if (raw) return text(data);
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        return text(`failed to parse layout JSON: ${e.message}`);
      }
      const display = await getDisplaySize();
      const prunedRaw = pruneNode(parsed, display);
      const pruned = Array.isArray(prunedRaw)
        ? { children: prunedRaw }
        : prunedRaw || { children: [] };
      const payload = {
        display: display ? { width: display.width, height: display.height } : null,
        legend: "b=bounds [x1,y1,x2,y2] as 0–1, c=center [x,y] as 0–1; click/scroll/check/sel/focus/longClick are flags; tap with send_input using c.",
        tree: pruned,
      };
      return text(JSON.stringify(payload));
    } finally {
      unlink(local).catch(() => {});
    }
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
