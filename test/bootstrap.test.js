import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readdir, readFile, rm, symlink } from 'node:fs/promises';
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

    // Assert named skills, not just a non-empty directory: the install root
    // also holds dotfiles (.vskills-config.json, .vskills-manifest.json), so a
    // count-only check passed even when zero skills were installed.
    const entries = await readdir(path.join(fakeHome, '.agents', 'skills'), { withFileTypes: true });
    const installed = new Set(entries.filter((e) => !e.name.startsWith('.')).map((e) => e.name));
    for (const name of ['ship', 'goals', 'grill', 'issues', 'snapshot', 'council']) {
      assert.ok(installed.has(name), `expected recommended skill "${name}" to be installed, got: ${[...installed].sort().join(', ')}`);
    }
    // Opt-in skills must stay out of the default install.
    assert.ok(!installed.has('herdr-orchestrator'), 'herdr-orchestrator is opt-in and must not install by default');
  } finally {
    await rm(fakeHome, { recursive: true, force: true });
  }
});

test('a second init run honours the persisted selection and is a no-op with zero retirements', async () => {
  const fakeHome = await mkdtemp(path.join(os.tmpdir(), 'vskills-second-run-'));
  try {
    const env = { ...process.env, HOME: fakeHome };
    await execFileAsync(process.execPath, [binPath, 'init', '--yes'], { env });
    const installRoot = path.join(fakeHome, '.agents', 'skills');

    const config = JSON.parse(await readFile(path.join(installRoot, '.vskills-config.json'), 'utf8'));
    assert.equal(config.selection, 'recommended', 'init must persist the recommended sentinel, not a frozen snapshot');

    const before = await readdir(installRoot);
    const second = await execFileAsync(process.execPath, [binPath, 'init', '--yes'], { env });
    assert.doesNotMatch(second.stdout, /retired/i);
    assert.deepEqual(await readdir(installRoot), before);

    const installed = new Set(
      (await readdir(installRoot, { withFileTypes: true }))
        .filter((e) => !e.name.startsWith('.'))
        .map((e) => e.name),
    );
    assert.ok(installed.has('ship'), `named skill "ship" went missing on the second run, got: ${[...installed].sort().join(', ')}`);
  } finally {
    await rm(fakeHome, { recursive: true, force: true });
  }
});
