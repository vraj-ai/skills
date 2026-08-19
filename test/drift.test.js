import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';
import { runList } from '../src/commands/list.js';
import { makeTmpDir, writeSkill, cleanup } from './helpers.js';

test('update with no drift refreshes and updates the manifest hash', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });

    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v2' });
    const result = await runUpdate({ names: [], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'installed');

    const installed = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.match(installed, /v2/);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('update skips a drifted skill, leaves it untouched, and reports it', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });

    await fs.appendFile(path.join(installRoot, 'alpha', 'SKILL.md'), '\nlocal edit\n', 'utf8');
    const before = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');

    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v2' });
    const result = await runUpdate({ names: [], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'drifted');
    assert.ok(result.messages.some((m) => m.includes('locally modified')));

    const after = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.equal(after, before);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('update --force overwrites a drifted skill with upstream content', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await fs.appendFile(path.join(installRoot, 'alpha', 'SKILL.md'), '\nlocal edit\n', 'utf8');

    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v2' });
    const result = await runUpdate({ names: ['alpha'], repoRoot: repo, installRoot, targets: [target], force: true });
    assert.equal(result.results[0].status, 'installed');

    const installed = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.match(installed, /v2/);
    assert.doesNotMatch(installed, /local edit/);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('update on a drifted skill repairs missing links without overwriting content', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await fs.appendFile(path.join(installRoot, 'alpha', 'SKILL.md'), '\nlocal edit\n', 'utf8');
    const before = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    await fs.rm(path.join(target, 'alpha'));

    const result = await runUpdate({ names: [], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'drifted');

    const after = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.equal(after, before);

    const linkPath = path.join(target, 'alpha');
    const stat = await fs.lstat(linkPath);
    assert.ok(stat.isSymbolicLink());
    assert.equal(await fs.realpath(linkPath), await fs.realpath(path.join(installRoot, 'alpha')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('list shows drifted status for a hand-modified installed skill', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await fs.appendFile(path.join(installRoot, 'alpha', 'SKILL.md'), '\nlocal edit\n', 'utf8');

    const { rows } = await runList({ repoRoot: repo, installRoot });
    assert.equal(rows[0].status, 'drifted');
  } finally {
    await cleanup(repo, installRoot, target);
  }
});
