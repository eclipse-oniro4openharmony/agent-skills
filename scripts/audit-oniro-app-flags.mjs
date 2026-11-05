#!/usr/bin/env node
// Check that every `oniro-app <command> --flag` the skills mention exists in
// the oniro-app this repository pins (`.oniro-app-version`), by asking that
// oniro-app for its own help. A renamed or invented flag
// (`reboot --wait-for-bundle` for `--wait-bundle`) then fails CI instead of
// failing the agent that follows the skill.
//
// Usage: node scripts/audit-oniro-app-flags.mjs [--cli "<command>"] [paths...]
//   --cli   how to run oniro-app (default: `oniro-app`), e.g. "npx -y @oniroproject/oniro-app@0.17.0"
//   paths   files or directories to scan (default: skills/)
//
// Only text inside code (inline `...` spans and fenced blocks) is read, and a
// snippet is cut at `→`, `|`, `&&`, `;` and the next `oniro-app`, so a flag is
// checked against the command it follows. Exits 1 listing each unknown command
// or flag with its file and line.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
let cli = 'oniro-app';
const paths = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--cli') cli = argv[++i];
  else paths.push(argv[i]);
}
if (paths.length === 0) paths.push('skills');

const [cliCmd, ...cliArgs] = cli.split(/\s+/).filter(Boolean);
const helpCache = new Map();

/** `oniro-app <path...> --help`, or null when that command does not exist. */
function help(path) {
  const key = path.join(' ');
  if (!helpCache.has(key)) {
    let text = null;
    try {
      text = execFileSync(cliCmd, [...cliArgs, ...path, '--help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      text = null;
    }
    // commander prints the root help for an unknown subcommand of a command
    // with no action; only a help whose usage line names the path counts.
    if (text && path.length && !new RegExp(`^Usage: \\S+ ${path.map(escape).join(' ')}\\b`, 'm').test(text)) text = null;
    helpCache.set(key, text);
  }
  return helpCache.get(key);
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The subcommand names a help text lists under `Commands:`. */
function subcommands(text) {
  const names = new Set();
  const section = /\nCommands:\n([\s\S]*?)(?:\n\S|$)/.exec(text);
  for (const line of section?.[1].split('\n') ?? []) {
    const m = /^ {2}([a-z][\w-]*)(?:\|[\w-]+)?\b/.exec(line);
    if (m && m[1] !== 'help') names.add(m[1]);
  }
  return names;
}

/** Every `--flag` (and `-x` short flag) a help text lists. */
function flags(text) {
  return new Set([...text.matchAll(/(?:^|[\s,])(--?[a-zA-Z][\w-]*)/gm)].map((m) => m[1]));
}

const rootFlags = flags(help([]) ?? '');
if (!help([])) {
  console.error(`Cannot run \`${cli} --help\`.`);
  process.exit(2);
}

function* files(path) {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) yield* files(join(path, entry));
  } else if (path.endsWith('.md')) {
    yield path;
  }
}

/** [line, code] for each piece of code in a markdown file. */
function* codeSnippets(text) {
  let fenced = false;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      yield [i + 1, line.replace(/#.*$/, '')];
      continue;
    }
    // Inline spans may wrap onto the next line in a list item; join a span that opens without closing.
    let joined = line;
    let extra = 0;
    while ((joined.match(/`/g) ?? []).length % 2 === 1 && i + extra + 1 < lines.length && extra < 3) {
      extra++;
      joined += ` ${lines[i + extra].trim()}`;
    }
    for (const m of joined.matchAll(/`([^`]+)`/g)) yield [i + 1, m[1]];
  }
}

const problems = [];
let checked = 0;
for (const root of paths) {
  for (const file of files(root)) {
    for (const [line, code] of codeSnippets(readFileSync(file, 'utf8'))) {
      for (const part of code.split(/→|\||&&|;/)) {
        for (const mention of part.split(/(?=\boniro-app\s)/)) {
          const m = /^oniro-app\s+(.*)$/.exec(mention.trim());
          if (!m) continue;
          const tokens = m[1].split(/\s+/).filter(Boolean);
          // The longest run of leading words that names a command.
          const path = [];
          let text = help([]);
          while (tokens.length && /^[a-z][\w-]*$/.test(tokens[0]) && subcommands(text).has(tokens[0])) {
            path.push(tokens.shift());
            text = help(path);
            if (!text) break;
          }
          if (!path.length) {
            const word = /^[a-z][\w-]*$/.test(tokens[0] ?? '') ? tokens[0] : undefined;
            if (word) problems.push(`${file}:${line}: unknown command \`oniro-app ${word}\``);
            continue;
          }
          if (!text) {
            problems.push(`${file}:${line}: \`oniro-app ${path.join(' ')}\` has no help`);
            continue;
          }
          // A command with subcommands named on its own (`oniro-app app`) is fine;
          // an unknown word after it is not.
          const subs = subcommands(text);
          if (subs.size && tokens[0] && /^[a-z][\w-]*$/.test(tokens[0]) && !subs.has(tokens[0])) {
            problems.push(`${file}:${line}: unknown command \`oniro-app ${path.join(' ')} ${tokens[0]}\``);
          }
          const known = flags(text);
          for (const token of tokens) {
            const flag = /^(--[a-zA-Z][\w-]*)/.exec(token)?.[1];
            if (!flag) continue;
            checked++;
            if (!known.has(flag) && !rootFlags.has(flag)) {
              problems.push(`${file}:${line}: \`oniro-app ${path.join(' ')}\` has no ${flag}`);
            }
          }
        }
      }
    }
  }
}

if (problems.length) {
  console.error([...new Set(problems)].join('\n'));
  console.error(`\n${new Set(problems).size} problem(s) against \`${cli}\`.`);
  process.exit(1);
}
console.log(`${checked} flag uses checked against \`${cli}\`: all exist.`);
