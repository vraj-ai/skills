import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { readConfig, writeConfig, defaultTargets } from '../src/config.js';
import { runInit } from '../src/commands/init.js';
import { makeTmpDir, writeSkill, cleanup } from './helpers.js';

test('with no config present, the built-in default target is used', async () => {
  const installRoot = await makeTmpDir();
  try {
    const { targets } = await readConfig(installRoot);
    assert.deepEqual(targets, defaultTargets());
  } finally {
    await cleanup(installRoot);
  }
});

test('a custom single target in config overrides the default', async () => {
  const installRoot = await makeTmpDir();
  try {
    await fs.writeFile(
      path.join(installRoot, '.vskills-config.json'),
      JSON.stringify({ targets: ['/tmp/custom-vskills-target'] }),
      'utf8'
    );
    const { targets } = await readConfig(installRoot);
    assert.deepEqual(targets, ['/tmp/custom-vskills-target']);
  } finally {
    await cleanup(installRoot);
  }
});

test('with no config present, the selection is null', async () => {
  const installRoot = await makeTmpDir();
  try {
    const { selection } = await readConfig(installRoot);
    assert.equal(selection, null);
  } finally {
    await cleanup(installRoot);
  }
});

test('writeConfig persists the selection without dropping existing targets', async () => {
  const installRoot = await makeTmpDir();
  try {
    await fs.writeFile(
      path.join(installRoot, '.vskills-config.json'),
      JSON.stringify({ targets: ['/tmp/custom-vskills-target'] }),
      'utf8'
    );
    await writeConfig(installRoot, { selection: ['alpha', 'beta'] });

    const config = await readConfig(installRoot);
    assert.deepEqual(config.targets, ['/tmp/custom-vskills-target']);
    assert.deepEqual(config.selection, ['alpha', 'beta']);
  } finally {
    await cleanup(installRoot);
  }
});

test('multiple configured targets each get a symlink from init', async () => {
  const repo = await makeTmpDir();
  const installRoot = await makeTmpDir();
  const targetA = await makeTmpDir();
  const targetB = await makeTmpDir();
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha' });
    await runInit({ repoRoot: repo, installRoot, targets: [targetA, targetB] });

    const a = await fs.lstat(path.join(targetA, 'alpha'));
    const b = await fs.lstat(path.join(targetB, 'alpha'));
    assert.ok(a.isSymbolicLink());
    assert.ok(b.isSymbolicLink());
  } finally {
    await cleanup(repo, installRoot, targetA, targetB);
  }
});
