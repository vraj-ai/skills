import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
import os from 'node:os';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, '..', 'bin', 'vskills.js');

test('--version prints a semver and exits 0', async () => {
  const { stdout } = await execFileAsync(process.execPath, [binPath, '--version']);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('--help lists all four commands and exits 0', async () => {
  const { stdout } = await execFileAsync(process.execPath, [binPath, '--help']);
  for (const cmd of ['init', 'update', 'list', 'add']) {
    assert.match(stdout, new RegExp(`\\b${cmd}\\b`));
  }
});

test('an unknown command exits non-zero naming the bad command', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [binPath, 'bogus-command']),
    (err) => {
      assert.equal(err.code, 1);
      assert.match(err.stderr, /unknown command: bogus-command/);
      return true;
    }
  );
});

// Regression test: npm/npx invoke bin scripts through a symlink in
// node_modules/.bin, so process.argv[1] is the symlink path, not this file's
// real path. Running through a symlink must still produce output.
test('running through a symlink (as npx/npm bin shims do) still runs the command', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vskills-symlink-test-'));
  try {
    const linkPath = path.join(tmp, 'vskills');
    await symlink(binPath, linkPath);
    const { stdout } = await execFileAsync(process.execPath, [linkPath, '--version']);
    assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// Regression test for the fresh-machine crash: the install root
// (~/.agents/skills, derived from HOME) must not need to exist beforehand.
// Deliberately does NOT pre-create the install root — that's the bug this
// guards against.
test('init on a fresh HOME with no install root yet succeeds and installs the recommended closure', async () => {
  const fakeHome = await mkdtemp(path.join(os.tmpdir(), 'vskills-fresh-home-'));
  try {
    const { stdout } = await execFileAsync(process.execPath, [binPath, 'init', '--yes'], {
      env: { ...process.env, HOME: fakeHome },
    });
    assert.match(stdout, /installing/i);

    const installedSkills = await readdir(path.join(fakeHome, '.agents', 'skills'));
    assert.ok(installedSkills.length > 0);
  } finally {
    await rm(fakeHome, { recursive: true, force: true });
  }
});
