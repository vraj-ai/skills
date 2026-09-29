import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanup, makeTmpDir } from './helpers.js';

const bin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'vskills.js');

// HOME/USERPROFILE point at a temp dir so the CLI's install root is never the
// real one. Every case here must fail before installing anything.
async function init(...args) {
  const home = await makeTmpDir();
  try {
    return spawnSync(process.execPath, [bin, 'init', ...args], {
      env: { ...process.env, HOME: home, USERPROFILE: home },
      encoding: 'utf8',
      stdin: 'ignore',
    });
  } finally {
    await cleanup(home);
  }
}

test('init rejects a misspelled flag instead of falling back to the stored selection', async () => {
  const r = await init('--recomended');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown option.*--recomended/);
});

test('init --only= rejects an unknown skill name (equals form is parsed, not ignored)', async () => {
  const r = await init('--only=no-such-skill');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no-such-skill/);
});

test('init --only with only commas is an error, not an empty selection', async () => {
  const r = await init('--only', ',,');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /empty/);
});
