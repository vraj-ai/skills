import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';
import { runList } from '../src/commands/list.js';
import { makeTmpDir, writeSkill, cleanup } from './helpers.js';
import { writeConfig } from '../src/config.js';

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

test('update honours the persisted selection: a deselected skill is retired, not refreshed', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1', dependencies: ['helper'] });
    await writeSkill(repo, 'helper', { name: 'helper', body: 'v1' });
    await writeSkill(repo, 'beta', { name: 'beta', body: 'v1' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    // Deselect beta after the fact, the way `init --only alpha` would.
    await writeConfig(installRoot, { selection: ['alpha'] });

    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v2', dependencies: ['helper'] });
    await writeSkill(repo, 'beta', { name: 'beta', body: 'v2' });
    const result = await runUpdate({ names: [], repoRoot: repo, installRoot, targets: [target] });

    const status = Object.fromEntries(result.results.map((r) => [r.name, r.status]));
    assert.equal(status.alpha, 'installed');
    assert.equal(status.helper, 'up-to-date', 'a dependency of a selected skill stays selected');
    assert.equal(status.beta, 'retired');
    assert.equal(await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8').then((s) => s.includes('v2')), true);
    await assert.rejects(fs.access(path.join(installRoot, 'beta')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('update with no stored selection still refreshes everything installed', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1' });
    await writeSkill(repo, 'beta', { name: 'beta', body: 'v1' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });

    await writeSkill(repo, 'beta', { name: 'beta', body: 'v2' });
    const result = await runUpdate({ names: [], repoRoot: repo, installRoot, targets: [target] });
    const status = Object.fromEntries(result.results.map((r) => [r.name, r.status]));
    assert.equal(status.beta, 'installed');
    assert.ok(!result.results.some((r) => r.status === 'retired'));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('update refuses to touch anything when the selected dependency graph is invalid', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1' });
    await writeSkill(repo, 'beta', { name: 'beta', body: 'v1' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await writeConfig(installRoot, { selection: ['alpha'] });

    const manifestPath = path.join(installRoot, '.vskills-manifest.json');
    const before = {
      alpha: await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8'),
      beta: await fs.readFile(path.join(installRoot, 'beta', 'SKILL.md'), 'utf8'),
      manifest: await fs.readFile(manifestPath, 'utf8'),
    };

    // The keep-set drives retirement here, so a dropped branch would silently
    // shrink it: both a missing dependency and a cycle must stop the run.
    const cases = [
      { deps: ['ghost'], expect: /unknown dependency "ghost"/ },
      { deps: ['beta'], cycle: true, expect: /dependency cycle detected/ },
    ];
    for (const { deps, cycle, expect } of cases) {
      await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v2', dependencies: deps });
      if (cycle) await writeSkill(repo, 'beta', { name: 'beta', body: 'v2', dependencies: ['alpha'] });

      const result = await runUpdate({ names: [], repoRoot: repo, installRoot, targets: [target] });
      assert.equal(result.ok, false);
      assert.deepEqual(result.results, []);
      assert.ok(result.messages.some((m) => expect.test(m)), result.messages.join('; '));
      assert.ok(result.messages.some((m) => m.includes('stopped before changing anything')));

      assert.equal(await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8'), before.alpha);
      assert.equal(await fs.readFile(path.join(installRoot, 'beta', 'SKILL.md'), 'utf8'), before.beta);
      assert.equal(await fs.readFile(manifestPath, 'utf8'), before.manifest);
    }
  } finally {
    await cleanup(repo, installRoot, target);
  }
});
