#!/usr/bin/env node
import { link, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(process.argv[2] || process.cwd());

const agentsTemplate = `# Agent Instructions

Read \`CONTEXT/architecture.md\` before changing project structure or durable decisions.

<!-- setup-vskills fills in: build/test/lint commands, the verification skill,
the tracker, and the ship / land / snapshot / resume-work workflow. -->
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
- In-flight work resumes from the ship record and the tracker, not from here.
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

const files = [
  ['AGENTS.md', agentsTemplate],
  [path.join('CONTEXT', 'architecture.md'), architectureTemplate],
];

for (const [relativePath, content] of files) {
  const status = await createIfMissing(path.join(projectRoot, relativePath), content);
  console.log(`${status.padEnd(10)} ${relativePath}`);
}
