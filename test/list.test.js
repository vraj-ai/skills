import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runInit } from '../src/commands/init.js';
import { runAdd } from '../src/commands/add.js';
import { runList } from '../src/commands/list.js';
import { makeTmpDir, writeSkill, cleanup } from './helpers.js';

test('list shows not-installed when nothing is installed', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    const { rows } = await runList({ repoRoot: repo, installRoot });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'not-installed');
  } finally {
    await cleanup(repo, installRoot);
  }
});

test('list shows installed after init', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    const { rows } = await runList({ repoRoot: repo, installRoot });
    assert.equal(rows[0].status, 'installed');
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('list shows a partially installed set correctly', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    await writeSkill(repo, 'beta', { name: 'beta' });
    await runAdd({ names: ['alpha'], repoRoot: repo, installRoot, targets: [target] });

    const { rows } = await runList({ repoRoot: repo, installRoot });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.status]));
    assert.equal(byName.alpha, 'installed');
    assert.equal(byName.beta, 'not-installed');
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('list marks each row\'s tier so the opt-in set is discoverable', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', recommended: true });
    await writeSkill(repo, 'beta', { name: 'beta' });
    const { rows } = await runList({ repoRoot: repo, installRoot });
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.tier]));
    assert.equal(byName.alpha, 'recommended');
    assert.equal(byName.beta, 'opt-in');
  } finally {
    await cleanup(repo, installRoot);
  }
});

test('list shows "missing" when the manifest says installed but the folder was deleted', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await fs.rm(path.join(installRoot, 'alpha'), { recursive: true, force: true });

    const { rows } = await runList({ repoRoot: repo, installRoot });
    assert.equal(rows[0].status, 'missing');
  } finally {
    await cleanup(repo, installRoot, target);
  }
});
