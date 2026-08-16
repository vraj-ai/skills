#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';
import { runList } from '../src/commands/list.js';
import { runAdd } from '../src/commands/add.js';
import { readConfig } from '../src/config.js';
import { banner, color, installLine, listLine, summarize, warningLine } from '../src/ui.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const installRoot = path.join(os.homedir(), '.agents', 'skills');

const HELP = `V's Skills (vskills) — installer CLI for vraj-ai/skills

Usage:
  vskills init                    Install every skill in the repo
  vskills init --yes              Same, but overwrite conflicting skills without asking
  vskills add <skill...>          Install a skill plus its dependencies (or refresh it)
  vskills update [skill...]       Update installed skills (all, or just the named ones)
  vskills update --force <skill>  Overwrite a locally-modified (drifted) skill
  vskills list                    Show every skill and its local install status

Options:
  -h, --help     Show this help
  -v, --version  Show the CLI version
`;

async function version() {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

// One summary prompt for every conflicting skill, with an editable keep-list —
// never a wall of per-skill y/N questions. Returns the names to overwrite.
async function promptForConflicts(conflicts) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(banner("V's Skills — existing skills differ from this repo"));
    for (const c of conflicts) {
      const have = c.installedVersion ? `v${c.installedVersion}` : 'unversioned';
      const repo = c.repoVersion ? `v${c.repoVersion}` : 'unversioned';
      console.log(`  ${color.yellow('~')} ${color.bold(c.name)} ${color.dim(`(installed: ${have}, repo: ${repo})`)}`);
    }
    console.log(color.dim('  Overwritten copies are backed up to ~/.agents/skills/.vskills-backup — nothing is deleted.'));

    const answer = (await rl.question(
      `\n  Overwrite ${conflicts.length} skill(s)? ${color.dim('[Y = all / n = none / e = edit list]')} `
    )).trim().toLowerCase();

    if (answer === 'n' || answer === 'no') return [];
    if (answer === 'e' || answer === 'edit') {
      const keepRaw = await rl.question('  Names to KEEP as-is (comma-separated): ');
      const keep = new Set(keepRaw.split(',').map((s) => s.trim()).filter(Boolean));
      const unknown = [...keep].filter((k) => !conflicts.some((c) => c.name === k));
      for (const u of unknown) console.log(color.yellow(`  ! "${u}" is not in the conflict list — ignored`));
      return conflicts.map((c) => c.name).filter((n) => !keep.has(n));
    }
    return conflicts.map((c) => c.name); // default: overwrite all (backed up)
  } finally {
    rl.close();
  }
}

function report(title, { results = [], messages = [] }) {
  console.log(banner(title));
  for (const r of results) console.log(installLine(r.status, r.name));
  if (results.length > 0) {
    console.log(color.dim('  ' + '─'.repeat(30)));
    console.log(`  ${summarize(results)}`);
  }
  for (const m of messages) console.error(warningLine(m));
  console.log();
}

export async function main(argv) {
  const [command, ...rest] = argv;

  if (!command || command === '-h' || command === '--help') {
    console.log(HELP);
    return 0;
  }
  if (command === '-v' || command === '--version') {
    console.log(await version());
    return 0;
  }

  if (!['init', 'add', 'update', 'list'].includes(command)) {
    console.error(`unknown command: ${command}`);
    console.log(HELP);
    return 1;
  }

  const { targets } = await readConfig(installRoot);

  if (command === 'init') {
    const assumeYes = rest.includes('--yes') || rest.includes('-y');
    const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) && !assumeYes;
    const resolveConflicts = interactive ? promptForConflicts : null;
    report("V's Skills — installing", await runInit({ repoRoot, installRoot, targets, resolveConflicts }));
    return 0;
  }

  if (command === 'list') {
    const { rows, warnings } = await runList({ repoRoot, installRoot });
    console.log(banner("V's Skills — status"));
    for (const row of rows) console.log(listLine(row.status, row.name, row.description));
    console.log(color.dim('  ' + '─'.repeat(30)));
    console.log(`  ${summarize(rows)}`);
    for (const w of warnings) console.error(warningLine(w));
    console.log();
    return 0;
  }

  if (command === 'add') {
    const names = rest.filter((a) => a !== '--force');
    if (names.length === 0) {
      console.error('vskills add requires at least one skill name');
      return 1;
    }
    const result = await runAdd({ names, repoRoot, installRoot, targets });
    report("V's Skills — add", result);
    return result.ok ? 0 : 1;
  }

  if (command === 'update') {
    const force = rest.includes('--force');
    const names = rest.filter((a) => a !== '--force');
    const result = await runUpdate({ names, repoRoot, installRoot, targets, force });
    report("V's Skills — update", result);
    return 0;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
