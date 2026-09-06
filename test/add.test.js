import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runAdd } from '../src/commands/add.js';
import { runInit } from '../src/commands/init.js';
import { readManifest } from '../src/manifest.js';
import { readConfig, writeConfig } from '../src/config.js';
import { makeTmpDir, writeSkill, cleanup } from './helpers.js';

test('add installs a single skill with no dependencies', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    const result = await runAdd({ names: ['alpha'], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.ok, true);
    assert.deepEqual(result.results.map((r) => r.name), ['alpha']);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('add installs a 2-deep dependency chain in dependency-first order', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'grilling', { name: 'grilling' });
    await writeSkill(repo, 'wayfinder', { name: 'wayfinder', dependencies: ['grilling'] });

    const result = await runAdd({ names: ['wayfinder'], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.ok, true);
    assert.deepEqual(result.results.map((r) => r.name), ['grilling', 'wayfinder']);

    const manifest = await readManifest(installRoot);
    assert.ok(manifest.skills.grilling);
    assert.ok(manifest.skills.wayfinder);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a dependency cycle is detected, reported, and installs nothing from it', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'a', { name: 'a', dependencies: ['b'] });
    await writeSkill(repo, 'b', { name: 'b', dependencies: ['a'] });

    const result = await runAdd({ names: ['a'], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.ok, false);
    assert.equal(result.results.length, 0);
    assert.ok(result.messages.some((m) => m.includes('dependency cycle detected')));
    await assert.rejects(fs.access(path.join(installRoot, 'a')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('add on an already-installed, unmodified skill refreshes it', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v1' });
    await runAdd({ names: ['alpha'], repoRoot: repo, installRoot, targets: [target] });

    await writeSkill(repo, 'alpha', { name: 'alpha', body: 'v2' });
    const result = await runAdd({ names: ['alpha'], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'installed');

    const installed = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.match(installed, /v2/);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('add with an unknown skill name errors clearly and installs nothing', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    const result = await runAdd({ names: ['nonexistent-skill'], repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.ok, false);
    assert.ok(result.messages.some((m) => m.includes('unknown skill(s): nonexistent-skill')));
    await assert.rejects(fs.access(path.join(installRoot, 'nonexistent-skill')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('add folds the added skill into a stored selection so a later init keeps it', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', recommended: true });
    await writeSkill(repo, 'extra', { name: 'extra' });
    await writeConfig(installRoot, { selection: ['alpha'] });

    await runAdd({ names: ['extra'], repoRoot: repo, installRoot, targets: [target] });
    const { selection } = await readConfig(installRoot);
    assert.deepEqual([...selection].sort(), ['alpha', 'extra']);

    // Mirrors what bin/vskills.js does with no explicit flag: pass the
    // stored selection straight through to runInit.
    const result = await runInit({ repoRoot: repo, installRoot, targets: [target], selection });
    assert.ok(!result.results.some((r) => r.status === 'retired'));
    await assert.doesNotReject(fs.access(path.join(installRoot, 'extra', 'SKILL.md')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('add does not create a selection when none is stored (an unfiltered install)', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const target = await makeTmpDir();
  try {
    await writeSkill(repo, 'extra', { name: 'extra' });
    await runAdd({ names: ['extra'], repoRoot: repo, installRoot, targets: [target] });
    const { selection } = await readConfig(installRoot);
    assert.equal(selection, null);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('add against a stored "recommended" sentinel pins the tier plus the added skill, so a later init keeps it', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', recommended: true });
    await writeSkill(repo, 'bravo', { name: 'bravo', recommended: true });
    await writeSkill(repo, 'extra', { name: 'extra' });
    await writeConfig(installRoot, { selection: 'recommended' });

    const result = await runAdd({ names: ['extra'], repoRoot: repo, installRoot, targets: [] });
    assert.equal(result.ok, true, result.messages.join('; '));

    // The sentinel cannot express "the tier plus extra", so it must have been
    // resolved to an explicit list — otherwise the next plain init retires extra.
    const { selection } = await readConfig(installRoot);
    assert.deepEqual([...selection].sort(), ['alpha', 'bravo', 'extra']);
  } finally {
    await cleanup(repo, installRoot);
  }
});

test('add of a skill the tier already covers keeps the "recommended" subscription instead of freezing it', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', recommended: true });
    await writeSkill(repo, 'bravo', { name: 'bravo', recommended: true });
    await writeConfig(installRoot, { selection: 'recommended' });

    const result = await runAdd({ names: ['alpha'], repoRoot: repo, installRoot, targets: [] });
    assert.equal(result.ok, true, result.messages.join('; '));

    const { selection } = await readConfig(installRoot);
    assert.equal(selection, 'recommended', 'a no-op add must not end the tier subscription');
  } finally {
    await cleanup(repo, installRoot);
  }
});

test('add of a recommended skill whose closure pulls an opt-in dependency keeps the subscription', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  try {
    // The real catalogue shape: a recommended root (snapshot) depending on an
    // opt-in skill (push-handoff). The dependency is in the closure, but it is
    // not what was asked for, so the sentinel must survive.
    await writeSkill(repo, 'alpha', { name: 'alpha', recommended: true, dependencies: ['helper'] });
    await writeSkill(repo, 'helper', { name: 'helper' });
    await writeConfig(installRoot, { selection: 'recommended' });

    const result = await runAdd({ names: ['alpha'], repoRoot: repo, installRoot, targets: [] });
    assert.equal(result.ok, true, result.messages.join('; '));
    assert.ok(result.results.some((r) => r.name === 'helper'), 'the dependency is still installed');

    const { selection } = await readConfig(installRoot);
    assert.equal(selection, 'recommended', 'an opt-in dependency must not freeze the tier subscription');
  } finally {
    await cleanup(repo, installRoot);
  }
});
