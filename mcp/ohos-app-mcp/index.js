#!/usr/bin/env node
// OHOS App MCP server — host-side app dev tools (ohpm, codelinter, hvigorw, deploy).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import { stat, readdir } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";

const OHPM = process.env.OHPM_PATH || "ohpm";
const HVIGORW = process.env.HVIGORW_PATH || "hvigorw";
const CODELINTER = process.env.CODELINTER_PATH || "codelinter";
const HDC = process.env.HDC_PATH || "hdc";
const DEVICE = process.env.DEVICE_SERIAL || "";
const DEFAULT_PROJECT = process.env.OHOS_PROJECT_PATH || "";

function run(cmd, args, { cwd, timeoutMs = 600_000, env } = {}) {
  return new Promise((resolve_) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(env || {}) },
    });
    let stdout = "";
    let stderr = "";
    const t = setTimeout(() => {
      child.kill("SIGKILL");
      stderr += `\n[timeout after ${timeoutMs}ms: ${cmd} ${args.join(" ")}]`;
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(t);
      resolve_({ code: 127, stdout: "", stderr: `${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(t);
      resolve_({ code: code ?? -1, stdout, stderr });
    });
  });
}

function fmt({ code, stdout, stderr }) {
  const body = `${stdout || ""}${stderr || ""}`.trim();
  if (code === 0) return body || "ok";
  return `[exit ${code}]\n${body}`;
}

const text = (s) => ({ content: [{ type: "text", text: s }] });

async function resolveProject(p) {
  const root = p || DEFAULT_PROJECT;
  if (!root) throw new Error("project_path is required (or set OHOS_PROJECT_PATH)");
  const abs = isAbsolute(root) ? root : resolve(process.cwd(), root);
  const s = await stat(abs).catch(() => null);
  if (!s || !s.isDirectory()) throw new Error(`project_path not a directory: ${abs}`);
  return abs;
}

// Prefer a project-local hvigorw wrapper if present; otherwise use HVIGORW from PATH.
async function hvigorwInvocation(projectRoot) {
  const isWin = process.platform === "win32";
  const localName = isWin ? "hvigorw.bat" : "hvigorw";
  const local = join(projectRoot, localName);
  const s = await stat(local).catch(() => null);
  if (s && s.isFile()) {
    return isWin ? { cmd: local, args: [] } : { cmd: "sh", args: [local] };
  }
  return { cmd: HVIGORW, args: [] };
}

async function hasOhModules(projectRoot) {
  const s = await stat(join(projectRoot, "oh_modules")).catch(() => null);
  return !!s;
}

// Walk build/default/outputs to find *-signed.hap (and *-unsigned.hap as fallback info).
async function findHaps(projectRoot) {
  const results = { signed: [], unsigned: [] };
  async function walk(dir, depth) {
    if (depth > 8) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "oh_modules" || e.name === ".git") continue;
        await walk(full, depth + 1);
      } else if (e.isFile() && e.name.endsWith(".hap")) {
        if (e.name.includes("unsigned")) results.unsigned.push(full);
        else if (e.name.includes("signed")) results.signed.push(full);
      }
    }
  }
  await walk(projectRoot, 0);
  return results;
}

const server = new McpServer({ name: "ohos-app", version: "0.1.0" });

server.registerTool(
  "ohpm_install",
  {
    title: "ohpm install",
    description: "Install OpenHarmony package dependencies (`ohpm install --all`). Required before building.",
    inputSchema: { project_path: z.string().optional() },
  },
  async ({ project_path }) => {
    const root = await resolveProject(project_path);
    return text(fmt(await run(OHPM, ["install", "--all"], { cwd: root })));
  },
);

server.registerTool(
  "codelinter",
  {
    title: "Code linter",
    description: "Run the OpenHarmony codelinter for static analysis of an app project.",
    inputSchema: {
      project_path: z.string().optional(),
      args: z.array(z.string()).optional(),
    },
  },
  async ({ project_path, args }) => {
    const root = await resolveProject(project_path);
    return text(fmt(await run(CODELINTER, args || [], { cwd: root, timeoutMs: 600_000 })));
  },
);

server.registerTool(
  "build_hap",
  {
    title: "Build HAP",
    description:
      "Build the app via `hvigorw assembleHap`. Auto-runs `ohpm install --all` if oh_modules is missing. " +
      "Reports paths of generated *-signed.hap (and *-unsigned.hap if signing is not configured — those won't install on locked devices).",
    inputSchema: {
      project_path: z.string().optional(),
      build_mode: z.enum(["debug", "release"]).optional(),
      product: z.string().optional(),
      tasks: z.array(z.string()).optional(),
      extra_args: z.array(z.string()).optional(),
    },
  },
  async ({ project_path, build_mode, product, tasks, extra_args }) => {
    const root = await resolveProject(project_path);
    let prelude = "";
    if (!(await hasOhModules(root))) {
      const r = await run(OHPM, ["install", "--all"], { cwd: root });
      prelude = `[ohpm install --all]\n${fmt(r)}\n\n`;
      if (r.code !== 0) return text(prelude + "[aborted: ohpm install failed]");
    }
    const { cmd, args } = await hvigorwInvocation(root);
    const buildArgs = [...args, ...(tasks || ["assembleHap"])];
    if (build_mode) buildArgs.push("-p", `buildMode=${build_mode}`);
    if (product) buildArgs.push("-p", `product=${product}`);
    if (extra_args) buildArgs.push(...extra_args);
    buildArgs.push("--no-daemon");
    const build = await run(cmd, buildArgs, { cwd: root, timeoutMs: 1_800_000 });
    const out = fmt(build);
    const haps = await findHaps(root);
    const summary =
      `\n\nsigned haps:\n${haps.signed.map((p) => `  ${p}`).join("\n") || "  (none)"}` +
      `\nunsigned haps:\n${haps.unsigned.map((p) => `  ${p}`).join("\n") || "  (none)"}`;
    return text(prelude + out + summary);
  },
);

server.registerTool(
  "clean",
  {
    title: "Clean",
    description: "Run `hvigorw clean` to remove build outputs.",
    inputSchema: { project_path: z.string().optional() },
  },
  async ({ project_path }) => {
    const root = await resolveProject(project_path);
    const { cmd, args } = await hvigorwInvocation(root);
    return text(fmt(await run(cmd, [...args, "clean", "--no-daemon"], { cwd: root })));
  },
);

server.registerTool(
  "list_haps",
  {
    title: "List HAPs",
    description: "List built HAPs under the project (signed and unsigned).",
    inputSchema: { project_path: z.string().optional() },
  },
  async ({ project_path }) => {
    const root = await resolveProject(project_path);
    const haps = await findHaps(root);
    return text(JSON.stringify(haps, null, 2));
  },
);

server.registerTool(
  "deploy",
  {
    title: "Deploy",
    description:
      "Install a built HAP to a connected device via `hdc install`. " +
      "If hap_path is omitted, picks the most recent *-signed.hap under the project. " +
      "Note: unsigned HAPs are rejected by most devices; ensure build-profile.json5 signing is configured.",
    inputSchema: {
      project_path: z.string().optional(),
      hap_path: z.string().optional(),
      replace: z.boolean().optional(),
    },
  },
  async ({ project_path, hap_path, replace }) => {
    let target = hap_path;
    if (!target) {
      const root = await resolveProject(project_path);
      const haps = await findHaps(root);
      if (haps.signed.length === 0) {
        const hint = haps.unsigned.length
          ? `\nFound only unsigned HAP(s) — configure signing in build-profile.json5:\n${haps.unsigned.map((p) => `  ${p}`).join("\n")}`
          : "\nRun build_hap first.";
      return text(`[no signed HAP found]${hint}`);
      }
      const stats = await Promise.all(haps.signed.map(async (p) => ({ p, m: (await stat(p)).mtimeMs })));
      stats.sort((a, b) => b.m - a.m);
      target = stats[0].p;
    }
    const argv = [];
    if (DEVICE && DEVICE !== "auto") argv.push("-t", DEVICE);
    argv.push("install");
    if (replace) argv.push("-r");
    argv.push(target);
    const r = await run(HDC, argv, { timeoutMs: 300_000 });
    return text(`[deploying ${target}]\n${fmt(r)}`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
