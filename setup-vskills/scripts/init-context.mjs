#!/usr/bin/env node
import { link, mkdir, open, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(process.argv[2] || process.cwd());

const agentsTemplate = `# Agent Instructions

Read \`CONTEXT/architecture.md\` before changing project structure or durable decisions.
Read \`CONTEXT/progress.md\` for the current verified milestone pointer.

Keep durable decisions in \`CONTEXT/architecture.md\`, keep progress bounded, and
use the project's tests, builds, git history, and goal artifacts as evidence.
Do not turn \`CONTEXT/progress.md\` into a session diary.
`;

const architectureTemplate = `# Architecture Context

## Purpose

<!-- Human-owned: state what this project is and what it must make possible. -->

## Locked Decisions

- None recorded.

## Invariants

- None recorded.

## Non-goals

- None recorded.

## Accepted Boundaries

- None recorded.

## Ownership

- \`AGENTS.md\` is the always-loaded project router.
- This file is human-owned and changes only when intent, decisions, invariants,
  non-goals, or accepted boundaries change.
- \`CONTEXT/progress.md\` is a bounded derived pointer, not a resume source.
- \`goals\` owns goal backlogs, handoffs, progress updates, and review verdicts.
`;

const progressTemplate = `# Progress

- Current milestone: Not started.
- Last verified edit: None.
- Verification: None.
`;

const runtimeIgnoreBlock = `# vskills runtime goal state
CONTEXT/goals/*/backlog.jsonl
CONTEXT/goals/*/lock.d/
CONTEXT/worktrees/
CONTEXT/goals/*/*.log
CONTEXT/worktrees/**/*.log
CONTEXT/worktrees/**/results.json
CONTEXT/worktrees/**/*.digest.json
`;

function isMissing(error) {
  return error?.code === 'ENOENT';
}

async function createIfMissing(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  const handle = await open(tempPath, 'wx', 0o600);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await link(tempPath, filePath);
    return 'created';
  } catch (error) {
    if (!isMissing(error) && error.code !== 'EEXIST') throw error;
    if (error.code === 'EEXIST') return 'preserved';
    throw error;
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}

async function ensureRuntimeIgnore() {
  const ignorePath = path.join(projectRoot, '.gitignore');
  const current = await readFile(ignorePath, 'utf8').catch((error) => {
    if (isMissing(error)) return '';
    throw error;
  });
  if (current.includes('# vskills runtime goal state')) return 'up-to-date';
  const next = `${current.trimEnd()}${current.trim() ? '\n\n' : ''}${runtimeIgnoreBlock}`;
  await writeFile(ignorePath, next, 'utf8');
  return current ? 'updated' : 'created';
}

const files = [
  ['AGENTS.md', agentsTemplate],
  [path.join('CONTEXT', 'architecture.md'), architectureTemplate],
  [path.join('CONTEXT', 'progress.md'), progressTemplate],
];

for (const [relativePath, content] of files) {
  const status = await createIfMissing(path.join(projectRoot, relativePath), content);
  console.log(`${status.padEnd(10)} ${relativePath}`);
}

console.log(`${(await ensureRuntimeIgnore()).padEnd(10)} .gitignore`);
