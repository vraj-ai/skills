import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, makeTmpDir, setupParallelFixture as setup, skillPath } from './helpers.js';

// #75: the runners must work under any agent harness, so the binary and the
// model pins are resolved from the environment instead of being hard-coded.
const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runners = [
  { skill: 'goals', branch: 'goals/demo/a' },
  { skill: 'ship', branch: 'ship/demo/a' },
];

// A shim that exits non-zero: whichever rung picks it up makes the run fail,
// so a passing run proves the earlier rung won.
async function shim(dir, name) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.writeFile(file, '#!/bin/sh\nexit 99\n');
  await fs.chmod(file, 0o755);
  return file;
}

async function copyBin(fake, dir, name) {
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.copyFile(fake, file);
  await fs.chmod(file, 0o755);
  return file;
}

// Every case runs one item end to end; merging it proves the resolved binary
// was the working fake rather than a losing shim.
async function runOne({ skill, branch }, env, root, repo, extra = {}) {
  const runner = skillPath(repoRoot, skill, 'scripts', 'parallel.mjs');
  const worktrees = path.join(repo, 'CONTEXT', 'worktrees', 'demo');
  const manifest = path.join(root, 'manifest.txt');
  const model = extra.model ?? 'opencode-go/glm-5.2';
  await fs.writeFile(manifest, `a|${branch}|${model}|Create done-a.txt\n`);
  const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
    env: {
      ...process.env,
      MAIN_BRANCH: 'main',
      TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
      CLEANUP: '0',
      ...env,
    },
  });
  return JSON.parse(stdout.trim());
}

for (const runner of runners) {
  test(`${runner.skill}: AGENT_BIN wins over OPENCODE_BIN`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const loser = await shim(path.join(root, 'loser'), 'opencode');
      const result = await runOne(runner, { AGENT_BIN: fake, OPENCODE_BIN: loser }, root, repo);
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: OPENCODE_BIN wins over the installed path when AGENT_BIN is unset`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const home = path.join(root, 'home');
      await shim(path.join(home, '.opencode', 'bin'), 'opencode');
      const result = await runOne(runner, { OPENCODE_BIN: fake, HOME: home, AGENT_BIN: '' }, root, repo);
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: with no binary env set, ~/.opencode/bin/opencode wins over PATH`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const home = path.join(root, 'home');
      await copyBin(fake, path.join(home, '.opencode', 'bin'), 'opencode');
      const pathDir = path.join(root, 'bin');
      await shim(pathDir, 'opencode');
      const result = await runOne(runner, {
        AGENT_BIN: '',
        OPENCODE_BIN: '',
        HOME: home,
        PATH: `${pathDir}${path.delimiter}${process.env.PATH}`,
      }, root, repo);
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: with no binary env and no install, the runner falls back to PATH`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const pathDir = path.join(root, 'bin');
      await copyBin(fake, pathDir, 'opencode');
      const result = await runOne(runner, {
        AGENT_BIN: '',
        OPENCODE_BIN: '',
        HOME: path.join(root, 'empty-home'),
        PATH: `${pathDir}${path.delimiter}${process.env.PATH}`,
      }, root, repo);
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: CONTRIBUTOR_MODEL overrides the default contributor pin`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const model = 'another-provider/glm-5.2';
      const result = await runOne(runner, { AGENT_BIN: fake, CONTRIBUTOR_MODEL: model }, root, repo, { model });
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: a manifest model that does not match the pin is rejected`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      await assert.rejects(
        runOne(runner, { AGENT_BIN: fake, CONTRIBUTOR_MODEL: 'another-provider/glm-5.2' }, root, repo),
        (error) => error.code === 1 && /fixed contributor model/.test(error.stderr),
      );
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: an unrecognised contributor model fails closed until its family is declared`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const model = 'acme/muse-1';
      await assert.rejects(
        runOne(runner, { AGENT_BIN: fake, CONTRIBUTOR_MODEL: model }, root, repo, { model }),
        (error) => error.code === 1 && /does not resolve to a model family/.test(error.stderr),
      );
      const result = await runOne(
        runner,
        { AGENT_BIN: fake, CONTRIBUTOR_MODEL: model, CONTRIBUTOR_FAMILY: 'muse' },
        root,
        repo,
        { model },
      );
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: a reviewer alias of the maker family is rejected even when the model strings differ`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const model = 'acme/muse-1';
      await assert.rejects(
        runOne(runner, {
          AGENT_BIN: fake,
          CONTRIBUTOR_MODEL: model,
          CONTRIBUTOR_FAMILY: 'muse',
          COUNCIL_GROK_MODEL: 'other/muse-2',
          COUNCIL_GROK_FAMILY: 'muse',
        }, root, repo, { model }),
        (error) => error.code === 1 && /maker model family/.test(error.stderr),
      );
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: only selected reviewers constrain the run, not unused pins`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      // A Grok maker with a Kimi reviewer: the unused default grok reviewer
      // pin must not veto a run that never selects it.
      const model = 'other-provider/grok-4.5';
      const reviewers = runner.skill === 'goals' ? 'council-kimi,council-qwen' : 'council-kimi';
      const result = await runOne(runner, {
        AGENT_BIN: fake,
        CONTRIBUTOR_MODEL: model,
        CONTRIBUTOR_FAMILY: 'grok',
        REVIEWERS: reviewers,
      }, root, repo, { model });
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: a reviewer pinned to the maker's exact model is rejected`, async () => {    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      // Same model string on both sides, but declared into different
      // families: the family check passes, so the exact-model check must fire.
      const model = 'custom/maker-1';
      const reviewers = runner.skill === 'goals' ? 'council-grok,council-qwen' : 'council-kimi';
      const reviewerEnv = runner.skill === 'goals'
        ? { COUNCIL_GROK_MODEL: model, COUNCIL_GROK_FAMILY: 'reviewfam' }
        : { COUNCIL_KIMI_MODEL: model, COUNCIL_KIMI_FAMILY: 'reviewfam' };
      await assert.rejects(
        runOne(runner, {
          AGENT_BIN: fake,
          CONTRIBUTOR_MODEL: model,
          CONTRIBUTOR_FAMILY: 'makerfam',
          REVIEWERS: reviewers,
          ...reviewerEnv,
        }, root, repo, { model }),
        (error) => error.code === 1 && /maker's own model/.test(error.stderr),
      );
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: family declarations cannot reclassify a recognised model`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      // Both pins are glm to any reader, but declare different families. The
      // declarations must be ignored and the run rejected on the known family.
      await assert.rejects(
        runOne(runner, {
          AGENT_BIN: fake,
          CONTRIBUTOR_FAMILY: 'makerfam',
          COUNCIL_GROK_MODEL: 'openrouter/zhipuai/glm-4',
          COUNCIL_GROK_FAMILY: 'reviewfam',
        }, root, repo),
        (error) => error.code === 1 && /maker model family/.test(error.stderr),
      );
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: HARDENED checks the extra adversary like a selected reviewer`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      // Sol maker with a Kimi reviewer passes unhardened (unused default
      // pins constrain nothing), but HARDENED=1 appends the default sol
      // adversary, which must not review the sol maker.
      const model = 'other-provider/gpt-5.6-sol';
      const reviewers = runner.skill === 'goals' ? 'council-kimi,council-qwen' : 'council-kimi';
      await assert.rejects(
        runOne(runner, {
          AGENT_BIN: fake,
          CONTRIBUTOR_MODEL: model,
          REVIEWERS: reviewers,
          HARDENED: '1',
        }, root, repo, { model }),
        (error) => error.code === 1 && /council-adversary resolves to maker model family/.test(error.stderr),
      );
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: HARDENED rejects an adversary sharing a family with a selected reviewer`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      // The adversary is a second opinion, not a second run of a reviewer's
      // own model: colliding families must fail before any agent is spawned.
      const reviewers = runner.skill === 'goals' ? 'council-grok,council-kimi' : 'council-grok';
      await assert.rejects(
        runOne(runner, {
          AGENT_BIN: fake,
          REVIEWERS: reviewers,
          COUNCIL_ADVERSARY_MODEL: 'another-provider/grok-4.5',
          HARDENED: '1',
        }, root, repo),
        (error) => error.code === 1 && /distinct model families/.test(error.stderr),
      );
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: HARDENED on default reviewer and adversary pins runs`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      const result = await runOne(runner, { AGENT_BIN: fake, HARDENED: '1' }, root, repo);
      assert.equal(result.failed.length, 0, JSON.stringify(result));
      assert.equal(result.merged.length, 1);
    } finally {
      await cleanup(root);
    }
  });

  test(`${runner.skill}: HARDENED conflict resolution is reviewed by every selected reviewer and still merges`, async () => {
    const root = await makeTmpDir('agent-bin-');
    try {
      const { repo, fake } = await setup(root);
      // The conflict re-review runs the hardened adversary too, so the gate
      // must count the selected reviewers — counting the T0 list alone blocks
      // every valid hardened resolution.
      await fs.writeFile(path.join(repo, 'shared.txt'), 'base\n');
      await execFileAsync('git', ['-C', repo, 'add', 'shared.txt']);
      await execFileAsync('git', ['-C', repo, 'commit', '-m', 'add shared file']);
      const prefix = runner.branch.slice(0, runner.branch.lastIndexOf('/'));
      const manifest = path.join(root, 'manifest.txt');
      await fs.writeFile(manifest, [
        `a|${prefix}/a|opencode-go/glm-5.2|conflict-a: update shared.txt`,
        `b|${prefix}/b|opencode-go/glm-5.2|conflict-b: update shared.txt`,
        '',
      ].join('\n'));
      const { stdout } = await execFileAsync(process.execPath, [
        skillPath(repoRoot, runner.skill, 'scripts', 'parallel.mjs'),
        repo, path.join(repo, 'CONTEXT', 'worktrees', 'demo'), manifest,
      ], {
        env: {
          ...process.env,
          AGENT_BIN: fake,
          MAIN_BRANCH: 'main',
          HARDENED: '1',
          CLEANUP: '0',
          TEST_CMDS_JSON: JSON.stringify({
            a: 'test "$(cat shared.txt)" = a',
            b: 'test "$(cat shared.txt)" = b || test "$(cat shared.txt)" = resolved',
          }),
        },
      });
      const result = JSON.parse(stdout.trim());
      assert.deepEqual(result.merged.map((item) => item.name), ['a', 'b'], JSON.stringify(result));
      assert.equal(result.conflicts.length, 1);
      const digest = JSON.parse(await fs.readFile(path.join(repo, 'CONTEXT', 'worktrees', 'demo', 'b.digest.json'), 'utf8'));
      assert.equal(digest.verdict, 'PASS');
    } finally {
      await cleanup(root);
    }
  });
}
