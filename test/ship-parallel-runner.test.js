import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, makeTmpDir, setupParallelFixture as setup } from './helpers.js';

// #30: `ship-parallel/scripts/parallel.mjs` is the runner `/ship` actually
// executes, and every existing runner test pinned the `parallel/` copy instead,
// so the fork shipped with zero coverage. These cover the fail-closed paths and
// each behaviour the fork deliberately diverges on.
const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.resolve(__dirname, '..', 'ship-parallel', 'scripts', 'parallel.mjs');

const baseEnv = (fake) => ({
  ...process.env,
  OPENCODE_BIN: fake,
  MAIN_BRANCH: 'main',
  CLEANUP: '0',
});

test('ship-parallel builds, reviews, verifies, and merges one isolated item', async () => {
  const root = await makeTmpDir('ship-parallel-');
  try {
    const { repo, fake } = await setup(root);
    const worktrees = path.join(repo, 'CONTEXT', 'worktrees', 'ship', 'demo');
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|ship/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: { ...baseEnv(fake), TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }) },
    });

    const result = JSON.parse(stdout.trim());
    assert.equal(result.failed.length, 0, JSON.stringify(result));
    assert.equal(result.merged.length, 1);
    assert.equal(await fs.readFile(path.join(repo, 'done-a.txt'), 'utf8'), 'done\n');
    const digest = JSON.parse(await fs.readFile(path.join(worktrees, 'a.digest.json'), 'utf8'));
    assert.equal(digest.verdict, 'PASS');
  } finally {
    await cleanup(root);
  }
});

test('ship-parallel fails closed on a blocking finding even when the reviewer says PASS', async () => {
  const root = await makeTmpDir('ship-parallel-');
  try {
    const { repo, fake } = await setup(root);
    const worktrees = path.join(repo, 'CONTEXT', 'worktrees', 'ship', 'demo');
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|ship/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...baseEnv(fake),
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        FAKE_BLOCKING: '1',
      },
    });

    const result = JSON.parse(stdout.trim());
    assert.equal(result.merged.length, 0);
    assert.equal(result.failed[0].name, 'a');
    await assert.rejects(fs.access(path.join(repo, 'done-a.txt')));
  } finally {
    await cleanup(root);
  }
});

test('ship-parallel accepts only ship/ branches, not the goals/ prefix', async () => {
  const root = await makeTmpDir('ship-parallel-');
  try {
    const { repo, fake } = await setup(root);
    const worktrees = path.join(repo, 'CONTEXT', 'worktrees', 'ship', 'demo');
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');

    await assert.rejects(
      execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
        env: { ...baseEnv(fake), TEST_CMDS_JSON: JSON.stringify({ a: 'true' }) },
      }),
      /unsafe branch/,
    );
  } finally {
    await cleanup(root);
  }
});

test('ship-parallel requires exactly one T0 reviewer, unlike the two-reviewer fork', async () => {
  const root = await makeTmpDir('ship-parallel-');
  try {
    const { repo, fake } = await setup(root);
    const worktrees = path.join(repo, 'CONTEXT', 'worktrees', 'ship', 'demo');
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|ship/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');

    await assert.rejects(
      execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
        env: {
          ...baseEnv(fake),
          TEST_CMDS_JSON: JSON.stringify({ a: 'true' }),
          REVIEWERS: 'council-grok,council-kimi',
        },
      }),
      /exactly one T0 council agent/,
    );
  } finally {
    await cleanup(root);
  }
});
