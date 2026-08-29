#!/usr/bin/env node
import { mkdir, open, readFile, readdir, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

export function findRepoRoot(from) {
  let dir = from;
  while (!existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`no package.json above ${from}: run this from a repo checkout`);
    dir = parent;
  }
  return dir;
}

export function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function atomicInstall(source, target, backupRoot) {
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

export async function installOpencode(options = {}) {
  const repoRoot = options.repoRoot || findRepoRoot(scriptDir);
  const sourceRoot = path.join(repoRoot, 'harness', 'opencode');
  const configRoot = options.configRoot || process.env.OPENCODE_CONFIG_DIR || path.join(os.homedir(), '.config', 'opencode');
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

  return { harness: 'opencode', results, configRoot };
}

export async function installOmp(options = {}) {
  const repoRoot = options.repoRoot || findRepoRoot(scriptDir);
  const sourceDir = path.join(repoRoot, 'harness', 'omp', 'agent');
  const agentsDir = options.agentsDir || process.env.OMP_AGENTS_DIR || path.join(os.homedir(), '.omp', 'agent', 'agents');
  const backupRoot = path.join(agentsDir, '.vskills-backup');
  const results = [];

  const files = (await readdir(sourceDir)).filter((name) => name.endsWith('.md')).sort();
  for (const name of files) {
    const status = await atomicInstall(
      path.join(sourceDir, name),
      path.join(agentsDir, name),
      backupRoot,
    );
    results.push({ path: name, status });
  }

  return { harness: 'omp', results, agentsDir };
}

export function researchHarness(harnessName, options = {}) {
  const normalized = (harnessName || '').trim().toLowerCase();
  const repoRoot = options.repoRoot || findRepoRoot(scriptDir);

  const integrationPlan = {
    harness: harnessName,
    normalized,
    researchedAt: new Date().toISOString(),
    supportedInvocations: ['grill', 'issues', 'ship', 'goals', 'snapshot'],
    templatesAvailable: {
      omp: path.join(repoRoot, 'harness', 'omp'),
      opencode: path.join(repoRoot, 'harness', 'opencode'),
    },
    plan: normalized === 'omp'
      ? 'Install OMP Role templates into ~/.omp/agent/agents (or $OMP_AGENTS_DIR).'
      : normalized === 'opencode'
        ? 'Install OpenCode agent and command profiles into ~/.config/opencode (or $OPENCODE_CONFIG_DIR).'
        : `Custom integration for '${harnessName}': map repo skills (grill, issues, ship/goals, snapshot) into harness-specific role templates or agent definitions.`,
  };

  return integrationPlan;
}

export async function installHarness(harnessName, options = {}) {
  const research = researchHarness(harnessName, options);
  const normalized = research.normalized;

  if (normalized === 'omp') {
    const installed = await installOmp(options);
    return { ...research, ...installed };
  }

  if (normalized === 'opencode') {
    const installed = await installOpencode(options);
    return { ...research, ...installed };
  }

  // Any other harness: research was completed, return integration report
  return {
    ...research,
    status: 'researched',
    message: `Researched '${harnessName}': no bundled installer directory; see integration plan for manual or custom configuration.`,
  };
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const harnessArg = process.argv[2] || process.env.HARNESS;
  if (!harnessArg || !String(harnessArg).trim()) {
    console.error('usage: install-harness.mjs <harness>\nSet HARNESS or pass the harness name. Do not assume omp.');
    process.exit(1);
  }
  const result = await installHarness(harnessArg);

  if (result.results) {
    for (const entry of result.results) {
      console.log(`${entry.status.padEnd(10)} ${entry.path}`);
    }
  }

  if (result.harness === 'opencode') {
    console.log('Restart OpenCode to load the profile.');
  } else if (result.harness === 'omp') {
    console.log(`Installed omp Role templates to ${result.agentsDir}.`);
  } else {
    console.log(`Researched harness '${result.harness}'.`);
    console.log(result.message);
  }
}
