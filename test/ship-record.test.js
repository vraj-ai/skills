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
const checker = skillPath(path.resolve(__dirname, '..'), 'ship', 'scripts', 'ship-record.mjs');

function record({ phase = 'build', size = 'feature', updated, next = 'Run the gate.' }) {
  return `# Objective\n\n- Phase: ${phase}\n- Size: ${size}\n- Updated: ${updated}\n- Next: ${next}\n\n## Work\n`;
}

async function run(cwd, ...args) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [checker, ...args], { cwd });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.code, stdout: error.stdout };
  }
}

test('ship-record reports open records, head drift, and malformed fields', async () => {
  const repo = await makeTmpDir('vskills-record-');
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
    git('init', '-q', '-b', 'main');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'one');
    const first = git('rev-parse', 'HEAD');
    const dir = path.join(repo, '.git', 'vskills', 'ship');
    await fs.mkdir(dir, { recursive: true });

    assert.match((await run(repo)).stdout, /no open records/);

    await fs.writeFile(path.join(dir, 'current.md'), record({ updated: `2026-10-25T00:00Z, main at ${first.slice(0, 7)}, ${repo}` }));
    await fs.writeFile(path.join(dir, 'finished.md'), record({ phase: 'done', updated: `2026-10-25T00:00Z, main at ${first}, ${repo}` }));
    let out = await run(repo);
    assert.equal(out.code, 0);
    assert.match(out.stdout, /current {2}phase=build {2}size=feature {2}head: current/);
    assert.doesNotMatch(out.stdout, /finished/);
    assert.match((await run(repo, 'finished')).stdout, /phase=done/);

    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'two');
    out = await run(repo, 'current');
    assert.equal(out.code, 0);
    assert.match(out.stdout, /head: moved to [0-9a-f]{12}/);

    await fs.writeFile(path.join(dir, 'broken.md'), record({ phase: 'shipping', size: 'huge', updated: 'yesterday', next: '' }));
    out = await run(repo);
    assert.equal(out.code, 1);
    assert.match(out.stdout, /problem: unknown phase "shipping"/);
    assert.match(out.stdout, /problem: unknown size "huge"/);
    assert.match(out.stdout, /problem: Updated is not/);
    assert.match(out.stdout, /problem: missing Next/);

    assert.equal((await run(repo, 'absent')).code, 1);
    for (const slug of ['../config', '..', 'sub/x']) assert.equal((await run(repo, slug)).code, 2, slug);

    await fs.rm(path.join(dir, 'broken.md'));
    for (const updated of [
      `yesterday, main at ${first}, ${repo}`,
      `2026-10-25T00:00Z, main at ${first}`,
      `2026-13-45Tnope, main at ${first}, ${repo}`,
    ]) {
      await fs.writeFile(path.join(dir, 'partial.md'), record({ updated }));
      out = await run(repo, 'partial');
      assert.equal(out.code, 1, updated);
      assert.match(out.stdout, /problem: Updated is not/, updated);
    }
  } finally {
    await cleanup(repo);
  }
});
