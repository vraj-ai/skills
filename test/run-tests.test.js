import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectTestFiles, invocationAction } from '../scripts/run-tests.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the runner collects only test files, including nested ones', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vskills-runner-'));
  try {
    await fs.mkdir(path.join(dir, 'nested', 'deeper'), { recursive: true });
    await fs.writeFile(path.join(dir, 'a.test.js'), '');
    await fs.writeFile(path.join(dir, 'nested', 'b.test.js'), '');
    await fs.writeFile(path.join(dir, 'nested', 'deeper', 'c.test.js'), '');
    await fs.writeFile(path.join(dir, 'd.spec.js'), '');
    // node's default `**/test/**/*.js` pattern would load these two as tests.
    await fs.writeFile(path.join(dir, 'helpers.js'), '');
    await fs.writeFile(path.join(dir, 'nested', 'fixture.json'), '{}');

    const found = (await collectTestFiles(dir)).map((f) => path.relative(dir, f));

    assert.deepEqual(found, [
      'a.test.js',
      'd.spec.js',
      path.join('nested', 'b.test.js'),
      path.join('nested', 'deeper', 'c.test.js'),
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('npm test runs the scoped collector, not node --test', async () => {
  // #29: `node --test` walks the whole tree ignoring .gitignore. The package
  // script is the source of truth that the collector is what npm test runs.
  const pkg = JSON.parse(await fs.readFile(path.join(repo, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node scripts/run-tests.mjs');
});

test('a path mismatch that still names this script is a loud failure, not a silent skip', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vskills-main-guard-'));
  try {
    const real = path.join(dir, 'run-tests.mjs');
    await fs.writeFile(real, '');
    const link = path.join(dir, 'alias.mjs');
    await fs.symlink(real, link);

    assert.equal(invocationAction(real, real), 'run');
    assert.equal(invocationAction(link, real), 'run', 'a symlink to this script must still run');
    assert.equal(invocationAction(real.toLowerCase(), real), 'run');
    assert.equal(invocationAction(path.join(dir, 'other.test.js'), real), 'skip');

    const other = path.join(dir, 'other', 'run-tests.mjs');
    await fs.mkdir(path.join(dir, 'other'));
    await fs.writeFile(other, '');
    assert.equal(
      invocationAction(other, real),
      'fail',
      'same basename, different file must not exit 0 having run nothing',
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
