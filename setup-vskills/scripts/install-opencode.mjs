#!/usr/bin/env node
import { mkdir, open, readFile, readdir, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const sourceRoot = path.join(repoRoot, 'opencode');
const configRoot = process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), '.config', 'opencode');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function atomicInstall(source, target, backupRoot) {
  const content = await readFile(source);
  const current = await readFile(target).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (current?.equals(content)) return 'up-to-date';

  await mkdir(path.dirname(target), { recursive: true });
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }

  let backup = null;
  if (current) {
    await mkdir(backupRoot, { recursive: true });
    backup = path.join(backupRoot, `${path.basename(target)}-${timestamp()}`);
    await rename(target, backup);
  }
  try {
    await rename(temp, target);
  } catch (error) {
    if (backup) await rename(backup, target).catch(() => {});
    throw error;
  }
  return current ? 'updated' : 'installed';
}

const backupRoot = path.join(configRoot, '.vskills-backup');
const results = [];
const retiredProfiles = new Map([
  ['command/council.md', `---
description: Run independent multi-model research, debate, voting, or scoped review.
agent: goals
---

Load the \`council\` skill and run the appropriate council protocol for
$ARGUMENTS. Keep goals as the sole orchestrator and forbid subagents from
delegating further. If no objective is supplied, ask for one before spawning
the council.
`],
]);
for (const [relativePath, expected] of retiredProfiles) {
  const target = path.join(configRoot, relativePath);
  const current = await readFile(target, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (current === expected) {
    const retiredRoot = path.join(backupRoot, 'retired');
    await mkdir(retiredRoot, { recursive: true });
    await rename(target, path.join(retiredRoot, `${relativePath.replaceAll('/', '-')}-${timestamp()}`));
    results.push({ path: relativePath, status: 'retired' });
  }
}
for (const kind of ['agent', 'command']) {
  const sourceDir = path.join(sourceRoot, kind);
  const files = (await readdir(sourceDir)).filter((name) => name.endsWith('.md')).sort();
  for (const name of files) {
    const status = await atomicInstall(
      path.join(sourceDir, name),
      path.join(configRoot, kind, name),
      path.join(backupRoot, kind),
    );
    results.push({ path: `${kind}/${name}`, status });
  }
}

for (const result of results) console.log(`${result.status.padEnd(10)} ${result.path}`);
console.log('Restart OpenCode to load the profile.');
