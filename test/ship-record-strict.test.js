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

function record({ phase = 'build', size = 'feature', next = 'Keep going.' } = {}) {
  return `# Objective\n\n- Phase: ${phase}\n- Size: ${size}\n- Updated: 2020-01-01T00:00:00.000Z, main at 0000000, /old/path\n- Next: ${next}\n\n## Context\nProse the tool must not touch.\n`;
}

async function run(cwd, ...args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [tool, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

async function makeRepo(text) {
  const repo = await makeTmpDir('vskills-attest-');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 't');
  git('config', 'user.email', 't@t');
  await fs.writeFile(path.join(repo, 'a.txt'), 'one\n');
  git('add', '.');
  git('commit', '-q', '-m', 'one');
  const dir = path.join(repo, '.git', 'vskills', 'ship');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'job.md'), text);
  return { repo, git, dir };
}

test('attest writes the header from live git and leaves the prose alone', async () => {
  const { repo, git, dir } = await makeRepo(record());
  try {
    const before = await fs.readFile(path.join(dir, 'job.md'), 'utf8');
    const attested = await run(repo, 'attest', 'job');
    assert.equal(attested.code, 0, attested.stderr);
    assert.match(attested.stdout, /head: current/);

    const after = await fs.readFile(path.join(dir, 'job.md'), 'utf8');
    const head = git('rev-parse', 'HEAD');
    assert.match(after, new RegExp(`^- Updated: \\d{4}-\\d{2}-\\d{2}T[^,]+, main at ${head}, `, 'm'));
    assert.ok(after.includes('## Context\nProse the tool must not touch.\n'), 'prose is byte-identical');
    assert.match(after, /^- Peak: feature$/m, 'the first attest records the size as its peak');
    // Only the header may change: the body after the blank line is untouched.
    const body = (value) => value.slice(value.indexOf('\n\n## '));
    assert.equal(body(after), body(before));

    assert.equal((await run(repo, 'check', 'job', '--require', 'head')).code, 0);
  } finally {
    await cleanup(repo);
  }
});

test('strict check fails on drift while a plain check still reports it', async () => {
  const { repo, git } = await makeRepo(record());
  try {
    await run(repo, 'attest', 'job');
    git('commit', '-q', '--allow-empty', '-m', 'later');

    const advisory = await run(repo, 'check', 'job');
    assert.equal(advisory.code, 0);
    assert.match(advisory.stdout, /head: moved to/);

    const strict = await run(repo, 'check', 'job', '--require', 'head');
    assert.equal(strict.code, 3);
    assert.match(strict.stdout, /unmet:/);

    const reattested = await run(repo, 'attest', 'job');
    assert.equal(reattested.code, 0);
    assert.equal((await run(repo, 'check', 'job', '--require', 'head')).code, 0);
  } finally {
    await cleanup(repo);
  }
});

test('a small record cannot sit in a design phase or be downgraded', async () => {
  const small = await makeRepo(record({ phase: 'design', size: 'small' }));
  try {
    const checked = await run(small.repo, 'check', 'job');
    assert.equal(checked.code, 1);
    assert.match(checked.stdout, /size small cannot sit in phase design/);
  } finally {
    await cleanup(small.repo);
  }

  const big = await makeRepo(record({ phase: 'build', size: 'medium' }));
  try {
    // The first attest records the size as the high-water mark.
    assert.equal((await run(big.repo, 'attest', 'job')).code, 0);
    const attestedText = await fs.readFile(path.join(big.dir, 'job.md'), 'utf8');
    assert.match(attestedText, /^- Peak: medium$/m);

    // A later edit that drops Size below that peak is rejected by check.
    await fs.writeFile(path.join(big.dir, 'job.md'), attestedText
      .replace('- Size: medium', '- Size: small')
      .replace(/^- Peak: medium$/m, '- Peak: feature'));
    const checked = await run(big.repo, 'check', 'job');
    assert.equal(checked.code, 1);
    assert.match(checked.stdout, /below the recorded peak feature/);
  } finally {
    await cleanup(big.repo);
  }
});
