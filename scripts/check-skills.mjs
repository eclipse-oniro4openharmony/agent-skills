#!/usr/bin/env node
// Keep the skills small and versioned:
// - every SKILL.md that tells the agent to run `oniro-app` names, in its
//   frontmatter `metadata.oniro-app-version`, the oniro-app it was validated
//   against, and that is the version in `.oniro-app-version` (the one the flag
//   audit installs), so a skill never claims a version CI did not check;
// - a SKILL.md body stays under the word budget, with the detail in
//   `references/`, since the whole body is loaded whenever the skill triggers.
//
// Usage: node scripts/check-skills.mjs [--max-words N] [skills-dir]
// Exits 1 listing each problem.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
let maxWords = 1600;
let root = 'skills';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--max-words') maxWords = Number(argv[++i]);
  else root = argv[i];
}

const pinned = readFileSync('.oniro-app-version', 'utf8').trim();
const problems = [];

for (const name of readdirSync(root)) {
  const file = join(root, name, 'SKILL.md');
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) {
    problems.push(`${file}: no frontmatter`);
    continue;
  }
  const body = text.slice(fm[0].length);
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words > maxWords) problems.push(`${file}: ${words} words, over ${maxWords}; move detail to references/`);

  if (!/`oniro-app\s/.test(body)) continue;
  const version = /^metadata:\s*\n(?:[ \t]+.*\n)*?[ \t]+oniro-app-version:\s*["']?([^"'\s]+)["']?\s*$/m.exec(fm[1] + '\n')?.[1];
  if (!version) problems.push(`${file}: uses oniro-app but has no metadata.oniro-app-version`);
  else if (version !== pinned) problems.push(`${file}: validated against oniro-app ${version}, but .oniro-app-version is ${pinned}`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`skills under ${maxWords} words, pinned to oniro-app ${pinned}.`);
