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

const RECORD = `# Objective

- Phase: review
- Size: feature
- Updated: 2026-10-25T00:00:00.000Z, feat at HEAD, /tmp/work
- Next: get a verdict

## Work
`;

async function run(cwd, ...args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [tool, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

async function makeRepo() {
  const repo = await makeTmpDir('vskills-verdict-');
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 't');
  git('config', 'user.email', 't@t');
  await fs.writeFile(path.join(repo, 'app.js'), 'export const one = 1;\n');
  git('add', '.');
  git('commit', '-q', '-m', 'one');
  git('switch', '-q', '-c', 'feat');
  await fs.writeFile(path.join(repo, 'app.js'), 'export const one = 1;\nexport const two = 2;\n');
  git('commit', '-qam', 'two');
  const dir = path.join(repo, '.git', 'vskills', 'ship');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'job.md'), RECORD);
  return { repo, git, dir };
}

test('a verdict is current only while the reviewed patch is unchanged', async () => {
  const { repo, git } = await makeRepo();
  try {
    const reviewed = git('rev-parse', 'HEAD');
    const added = await run(repo, 'verdict', 'add', 'job', '--pr', '7', '--by', 'agent:reviewer', '--at', reviewed, '--base', 'main');
    assert.equal(added.code, 0, added.stderr);
    assert.match(added.stdout, /verdict=recorded/);

    const current = await run(repo, 'verdict', 'check', 'job', '--pr', '7');
    assert.equal(current.code, 0, current.stdout + current.stderr);

    // A documentation-only change still changes the patch and needs a fresh
    // verdict: in this repository documentation is executable behaviour.
    await fs.writeFile(path.join(repo, 'NOTES.md'), 'explain the flag\n');
    git('add', '.');
    git('commit', '-qm', 'docs');
    const stale = await run(repo, 'verdict', 'check', 'job', '--pr', '7');
    assert.equal(stale.code, 3, stale.stdout);
    assert.match(stale.stdout, /verdict=stale/);
  } finally {
    await cleanup(repo);
  }
});

test('a commit made only after the review is stale, and a missing revision is unverified', async () => {
  const { repo, git } = await makeRepo();
  try {
    const reviewed = git('rev-parse', 'HEAD');
    await run(repo, 'verdict', 'add', 'job', '--pr', '9', '--by', 'human:vraj', '--at', reviewed, '--base', 'main');

    const absent = await run(repo, 'verdict', 'check', 'job', '--pr', '99');
    assert.equal(absent.code, 3);
    assert.match(absent.stdout, /verdict=unknown/);

    const bogus = await run(repo, 'verdict', 'add', 'job', '--pr', '9', '--by', 'agent:x', '--at', 'deadbeef', '--base', 'main');
    assert.equal(bogus.code, 3, bogus.stderr);
    assert.match(bogus.stderr, /cannot resolve revision/);
  } finally {
    await cleanup(repo);
  }
});

test('a verdict cannot come from the author, and an empty diff is not verifiable', async () => {
  const { repo, git } = await makeRepo();
  try {
    const self = await run(repo, 'verdict', 'add', 'job', '--pr', '5', '--by', 'agent:self', '--at', 'HEAD', '--base', 'main');
    assert.equal(self.code, 2, self.stderr);
    assert.match(self.stderr, /did not write the code/);

    const empty = await run(repo, 'verdict', 'add', 'job', '--pr', '5', '--by', 'agent:reviewer', '--at', 'main', '--base', 'main');
    assert.equal(empty.code, 3, empty.stderr);
    assert.match(empty.stderr, /no diff to verify/);
  } finally {
    await cleanup(repo);
  }
});
