import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectTestFiles } from '../scripts/run-tests.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the runner collects only test files, including nested ones', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vskills-runner-'));
  try {
    await fs.mkdir(path.join(dir, 'nested', 'deeper'), { recursive: true });
    await fs.writeFile(path.join(dir, 'a.test.js'), '');
    await fs.writeFile(path.join(dir, 'nested', 'b.test.js'), '');
    await fs.writeFile(path.join(dir, 'nested', 'deeper', 'c.test.js'), '');
    // node's default `**/test/**/*.js` pattern would load these two as tests.
    await fs.writeFile(path.join(dir, 'helpers.js'), '');
    await fs.writeFile(path.join(dir, 'nested', 'fixture.json'), '{}');

    const found = (await collectTestFiles(dir)).map((f) => path.relative(dir, f));

    assert.deepEqual(found, [
      'a.test.js',
      path.join('nested', 'b.test.js'),
      path.join('nested', 'deeper', 'c.test.js'),
    ]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('the runner never reaches outside test/, even with a worktree checked out', async () => {
  // #29: `node --test` walks the whole tree ignoring .gitignore, so a git
  // worktree under CONTEXT/worktrees/ double-counts every test file and can
  // inject foreign failures. Collection is rooted at test/, so it cannot.
  const worktree = path.join(repo, 'CONTEXT', 'worktrees', 'runner-scope-check', 'test');
  await fs.mkdir(worktree, { recursive: true });
  try {
    await fs.writeFile(path.join(worktree, 'foreign.test.js'), '');
    const found = await collectTestFiles(path.join(repo, 'test'));

    assert.ok(found.length > 0, 'expected the real suite to be collected');
    assert.ok(
      found.every((f) => !f.includes(`${path.sep}worktrees${path.sep}`)),
      'collection leaked into CONTEXT/worktrees/',
    );
    // helpers.js is a helper module, not a test; counting it was a phantom pass.
    assert.ok(found.every((f) => f.endsWith('.test.js')));
  } finally {
    await fs.rm(path.join(repo, 'CONTEXT', 'worktrees', 'runner-scope-check'), { recursive: true, force: true });
  }
});
