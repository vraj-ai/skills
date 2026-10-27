import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, makeTmpDir, skillPath } from './helpers.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tool = skillPath(path.resolve(__dirname, '..'), 'ship-record', 'scripts', 'ship-record.mjs');

function record(branch, worktree) {
  return `# Objective\n\n- Phase: build\n- Size: feature\n- Updated: 2026-01-01T00:00:00.000Z, ${branch} at 0000000, ${worktree}\n- Next: keep going\n\n## Context\nModel-written prose.\n`;
}

async function run(cwd, ...args) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [tool, ...args], { cwd });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '' };
  }
}

async function makeRepo() {
  const repo = await makeTmpDir('vskills-observe-');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 't');
  git('config', 'user.email', 't@t');
  await fs.writeFile(path.join(repo, 'a.txt'), 'one\n');
  git('add', '.');
  git('commit', '-q', '-m', 'one');
  git('switch', '-q', '-c', 'feat');
  const dir = path.join(repo, '.git', 'vskills', 'ship');
  await fs.mkdir(dir, { recursive: true });
  return { repo, git, dir };
}

test('observe records live position in a sidecar and leaves the record alone', async () => {
  const { repo, git, dir } = await makeRepo();
  try {
    const file = path.join(dir, 'job.md');
    await fs.writeFile(file, record('feat', repo));
    const before = await fs.readFile(file, 'utf8');
    await fs.writeFile(path.join(repo, 'dirty.txt'), 'wip\n');
    git('add', 'a.txt');

    const observed = await run(repo, 'observe', 'job');
    assert.equal(observed.code, 0, observed.stdout);
    assert.match(observed.stdout, /pushed=false/);

    const sidecar = JSON.parse(await fs.readFile(path.join(dir, 'job.observed.json'), 'utf8'));
    assert.equal(sidecar.branch, 'feat');
    assert.equal(sidecar.head, git('rev-parse', 'HEAD'));
    assert.deepEqual(sidecar.dirty.untracked, ['dirty.txt']);
    assert.equal(sidecar.pushed, false);

    assert.equal(await fs.readFile(file, 'utf8'), before, 'the model-written record is byte-identical');

    // check surfaces the checkpoint without changing the verdict on its own.
    const checked = await run(repo, 'check', 'job');
    assert.equal(checked.code, 0);
    assert.match(checked.stdout, /observed: .*dirty=1/);
  } finally {
    await cleanup(repo);
  }
});

test('observe without a slug picks the single matching record and stays silent otherwise', async () => {
  const { repo, git, dir } = await makeRepo();
  try {
    await fs.writeFile(path.join(dir, 'job.md'), record('feat', repo));
    await fs.writeFile(path.join(dir, 'other.md'), record('someone-else', '/elsewhere'));
    git('switch', '-q', '-c', 'unrelated');

    // The current branch matches no record, so hook mode is a no-op.
    const silent = await run(repo, 'observe');
    assert.equal(silent.code, 0);
    assert.equal(silent.stdout.trim(), '');
    await assert.rejects(fs.access(path.join(dir, 'job.observed.json')));

    git('switch', '-q', 'feat');
    const matched = await run(repo, 'observe');
    assert.equal(matched.code, 0);
    assert.match(matched.stdout, /job  observed/);
    await fs.access(path.join(dir, 'job.observed.json'));
  } finally {
    await cleanup(repo);
  }
});

test('observe never fails a host, even outside a repository', async () => {
  const outside = await makeTmpDir('vskills-norepo-');
  try {
    const result = await run(outside, 'observe');
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), '');
  } finally {
    await cleanup(outside);
  }
});
