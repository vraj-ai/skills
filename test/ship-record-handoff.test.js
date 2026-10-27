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

function record({ next = 'Keep going.', extra = '' } = {}) {
  return `# Objective\n\n- Phase: build\n- Size: feature\n- Updated: 2026-01-01T00:00:00.000Z, feat at 0000000, /old\n- Next: ${next}\n${extra}\n## Context\nModel prose.\n`;
}

async function run(cwd, ...args) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [tool, ...args], { cwd });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

async function makeRepo(text) {
  const repo = await makeTmpDir('vskills-handoff-');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'feat');
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

test('export carries the record plus captured pushed and dirty state', async () => {
  const { repo, git } = await makeRepo(record());
  try {
    await fs.writeFile(path.join(repo, 'wip.txt'), 'uncommitted\n');
    const exported = await run(repo, 'handoff', 'export', 'job');
    assert.equal(exported.code, 0, exported.stderr);
    assert.match(exported.stdout, /<!-- vskills-handoff slug="job" version="1" -->/);
    assert.match(exported.stdout, new RegExp(`- Head: ${git('rev-parse', 'HEAD')}`));
    assert.match(exported.stdout, /- Pushed: no/);
    assert.match(exported.stdout, /untracked: wip\.txt/);
    assert.match(exported.stdout, /## Record\n\n```markdown/);
    assert.match(exported.stdout, /Model prose\./);
  } finally {
    await cleanup(repo);
  }
});

test('export refuses a committable path and a record that looks like a secret', async () => {
  const { repo } = await makeRepo(record());
  try {
    const inside = await run(repo, 'handoff', 'export', 'job', '--out', path.join(repo, 'HANDOFF.md'));
    assert.equal(inside.code, 4, inside.stdout);
    assert.match(inside.stderr, /inside the repository/);
  } finally {
    await cleanup(repo);
  }

  const leaky = await makeRepo(record({ extra: '\ntoken: ghp_' + 'a'.repeat(36) + '\n' }));
  try {
    const refused = await run(leaky.repo, 'handoff', 'export', 'job');
    assert.equal(refused.code, 4, refused.stdout);
    assert.match(refused.stderr, /GitHub token/);
  } finally {
    await cleanup(leaky.repo);
  }
});

test('import restores a record from a handoff and backs up the previous one', async () => {
  const { repo, dir } = await makeRepo(record({ next: 'Old plan.' }));
  try {
    const bundle = path.join(repo, 'handoff.md');
    const exported = await run(repo, 'handoff', 'export', 'job');
    assert.equal(exported.code, 0);
    await fs.writeFile(bundle, exported.stdout.replace('Old plan.', 'New plan.'));
    // export refuses writing inside the repo, but a test fixture may live there.

    const imported = await run(repo, 'handoff', 'import', 'job', '--from', bundle);
    assert.equal(imported.code, 0, imported.stderr);
    assert.match(imported.stdout, /handoff=imported/);
    assert.match(await fs.readFile(path.join(dir, 'job.md'), 'utf8'), /- Next: New plan\./);

    const backups = (await fs.readdir(dir)).filter((name) => name.startsWith('job.md.bak-'));
    assert.equal(backups.length, 1);
    assert.match(await fs.readFile(path.join(dir, backups[0]), 'utf8'), /Old plan\./);

    const again = await run(repo, 'handoff', 'import', 'job', '--from', bundle);
    assert.match(again.stdout, /handoff=unchanged/);
  } finally {
    await cleanup(repo);
  }
});

test('import rejects a handoff with no usable record', async () => {
  const { repo } = await makeRepo(record());
  try {
    const junk = path.join(repo, 'junk.md');
    await fs.writeFile(junk, 'no fence here\n');
    const rejected = await run(repo, 'handoff', 'import', 'job', '--from', junk);
    assert.equal(rejected.code, 1);
    assert.match(rejected.stderr, /no fenced record block/);
  } finally {
    await cleanup(repo);
  }
});
