import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, makeTmpDir } from './helpers.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.resolve(__dirname, '..', 'parallel', 'scripts', 'parallel.mjs');

async function git(repo, ...args) {
  return execFileAsync('git', ['-C', repo, ...args]);
}

async function setup(root) {
  const repo = path.join(root, 'repo');
  await fs.mkdir(repo);
  await execFileAsync('git', ['init', '-b', 'main', repo]);
  await git(repo, 'config', 'user.name', 'Test Agent');
  await git(repo, 'config', 'user.email', 'test@example.com');
  await fs.writeFile(path.join(repo, 'README.md'), 'base\n');
  await git(repo, 'add', 'README.md');
  await git(repo, 'commit', '-m', 'base');

  const fake = path.join(root, 'fake-opencode.mjs');
  await fs.writeFile(fake, `#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const dir = args[args.indexOf('--dir') + 1];
const model = args[args.indexOf('--model') + 1];
const prompt = args.at(-1);
const permission = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT).agent.build.permission;
if (prompt.includes('Resolve the active merge')) {
  writeFileSync(dir + '/shared.txt', 'resolved\\n');
  execFileSync('git', ['-C', dir, 'add', 'shared.txt']);
  console.log('RESULT: PASS');
} else if (!prompt.includes('T0 ')) {
  if (permission.task !== 'deny' || permission.edit !== 'allow' || permission.external_directory !== 'allow') process.exit(20);
  const name = prompt.includes('shared.txt') ? 'shared.txt' : (prompt.includes('done-b.txt') ? 'done-b.txt' : 'done-a.txt');
  const content = prompt.includes('conflict-b') ? 'b\\n' : (prompt.includes('conflict-a') ? 'a\\n' : 'done\\n');
  writeFileSync(dir + '/' + name, content);
  execFileSync('git', ['-C', dir, 'add', name]);
  execFileSync('git', ['-C', dir, 'commit', '-m', 'build ' + name]);
  console.log('RESULT: PASS');
} else {
  if (permission.task !== 'deny' || permission.edit !== 'deny' || permission.external_directory !== 'deny') process.exit(21);
  if (process.env.FAKE_MUTATE_REF === '1' && model.includes('grok')) {
    execFileSync('git', ['-C', dir, 'update-ref', 'refs/heads/goals/demo/a', 'HEAD^']);
  }
  if (process.env.FAKE_HIDE_MUTATION === '1' && model.includes('grok')) {
    execFileSync('git', ['-C', dir, 'update-index', '--assume-unchanged', 'README.md']);
    writeFileSync(dir + '/README.md', 'hidden mutation\\n');
  }
  console.log('VERDICT: PASS');
  if (process.env.FAKE_MALFORMED === '1') {
    console.log('FINDINGS: [{"severity":"P1"}]');
    console.log('FOLLOWUPS: []');
    process.exit(0);
  }
  console.log(process.env.FAKE_BLOCKING === '1'
    ? 'FINDINGS: [{"severity":"P1","file":"x:1","trigger":"x","wrong_behavior":"y"}]'
    : 'FINDINGS: []');
  console.log('FOLLOWUPS: []');
  if (process.env.FAKE_TRAILING_PROSE === '1') console.log('This is not part of the required footer.');
}
`);
  await fs.chmod(fake, 0o755);
  return { repo, fake, worktrees: path.join(repo, 'CONTEXT', 'worktrees', 'demo') };
}

test('parallel runner builds, reviews, verifies, and merges one isolated item', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        CLEANUP: '0',
      },
    });

    const result = JSON.parse(stdout.trim());
    assert.equal(result.failed.length, 0, JSON.stringify(result));
    assert.equal(result.merged.length, 1);
    assert.equal(await fs.readFile(path.join(repo, 'done-a.txt'), 'utf8'), 'done\n');
    const digest = JSON.parse(await fs.readFile(path.join(worktrees, 'a.digest.json'), 'utf8'));
    assert.equal(digest.verdict, 'PASS');
    assert.deepEqual(digest.files_touched, ['done-a.txt']);
  } finally {
    await cleanup(root);
  }
});

test('parallel runner fails closed on a blocking finding even when the reviewer says PASS', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        FAKE_BLOCKING: '1',
        CLEANUP: '0',
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

test('parallel runner fails closed on malformed review findings', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        FAKE_MALFORMED: '1',
        CLEANUP: '0',
      },
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.merged.length, 0);
    assert.equal(result.failed[0].name, 'a');
  } finally {
    await cleanup(root);
  }
});

test('parallel runner fails closed when a reviewer mutates a branch ref', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        FAKE_MUTATE_REF: '1',
        CLEANUP: '0',
      },
    });
    const result = JSON.parse(stdout.trim());
    assert.equal(result.merged.length, 0);
    assert.equal(result.failed[0].name, 'a');
  } finally {
    await cleanup(root);
  }
});

test('parallel runner detects reviewed content hidden with assume-unchanged', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        FAKE_HIDE_MUTATION: '1',
        CLEANUP: '0',
      },
    });
    assert.equal(JSON.parse(stdout.trim()).merged.length, 0);
  } finally {
    await cleanup(root);
  }
});

test('parallel runner requires the review contract to be the final three lines', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        FAKE_TRAILING_PROSE: '1',
        CLEANUP: '0',
      },
    });
    assert.equal(JSON.parse(stdout.trim()).merged.length, 0);
  } finally {
    await cleanup(root);
  }
});

test('conflict resolutions receive two isolated reviews before merge', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    await fs.writeFile(path.join(repo, 'shared.txt'), 'base\n');
    await git(repo, 'add', 'shared.txt');
    await git(repo, 'commit', '-m', 'add shared file');
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, [
      'a|goals/demo/a|opencode-go/glm-5.2|conflict-a: update shared.txt',
      'b|goals/demo/b|opencode-go/glm-5.2|conflict-b: update shared.txt',
      '',
    ].join('\n'));
    const { stdout } = await execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({
          a: 'test "$(cat shared.txt)" = a',
          b: 'test "$(cat shared.txt)" = b || test "$(cat shared.txt)" = resolved',
        }),
        CLEANUP: '0',
      },
    });
    const result = JSON.parse(stdout.trim());
    assert.deepEqual(result.merged.map((item) => item.name), ['a', 'b']);
    assert.equal(result.conflicts.length, 1);
    assert.equal(await fs.readFile(path.join(repo, 'shared.txt'), 'utf8'), 'resolved\n');
    const digest = JSON.parse(await fs.readFile(path.join(worktrees, 'b.digest.json'), 'utf8'));
    assert.equal(digest.verdict, 'PASS');
  } finally {
    await cleanup(root);
  }
});

test('multi-item batches require a complete command map', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, [
      'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt',
      'b|goals/demo/b|opencode-go/glm-5.2|Create done-b.txt',
      '',
    ].join('\n'));
    await assert.rejects(execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
      },
    }), (error) => error.code === 1 && /has no locked Verification-command/.test(error.stderr));
  } finally {
    await cleanup(root);
  }
});

test('review models cannot resolve to the contributor family', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    await assert.rejects(execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        COUNCIL_GROK_MODEL: 'another-provider/glm-5.2',
      },
    }), (error) => error.code === 1 && /maker model family/.test(error.stderr));
  } finally {
    await cleanup(root);
  }
});

test('parallel runner rejects blank verification commands and duplicate reviewer families', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, 'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt\n');
    const baseEnv = {
      ...process.env,
      OPENCODE_BIN: fake,
      MAIN_BRANCH: 'main',
    };
    await assert.rejects(execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: { ...baseEnv, TEST_CMDS_JSON: JSON.stringify({ a: '   ' }) },
    }), (error) => error.code === 1 && /has no locked Verification-command/.test(error.stderr));
    await assert.rejects(execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...baseEnv,
        TEST_CMDS_JSON: JSON.stringify({ a: 'test -f done-a.txt' }),
        COUNCIL_KIMI_MODEL: 'another-provider/grok-4.5',
      },
    }), (error) => error.code === 1 && /distinct model families/.test(error.stderr));
  } finally {
    await cleanup(root);
  }
});

test('STRICT_BATCH rolls back earlier integrations when a later item fails', async () => {
  const root = await makeTmpDir('parallel-runner-');
  try {
    const { repo, fake, worktrees } = await setup(root);
    const manifest = path.join(root, 'manifest.txt');
    await fs.writeFile(manifest, [
      'a|goals/demo/a|opencode-go/glm-5.2|Create done-a.txt',
      'b|goals/demo/b|opencode-go/glm-5.2|Create done-b.txt',
      '',
    ].join('\n'));
    await assert.rejects(execFileAsync(process.execPath, [runner, repo, worktrees, manifest], {
      env: {
        ...process.env,
        OPENCODE_BIN: fake,
        MAIN_BRANCH: 'main',
        TEST_CMDS_JSON: JSON.stringify({
          a: 'test -f done-a.txt',
          b: 'test -f done-b.txt && test ! -f done-a.txt',
        }),
        STRICT_BATCH: '1',
        CLEANUP: '0',
      },
    }), (error) => error.code === 1);

    const result = JSON.parse(await fs.readFile(path.join(worktrees, 'results.json'), 'utf8'));
    assert.equal(result.merged.length, 0);
    assert.equal((await git(repo, 'branch', '--show-current')).stdout.trim(), 'main');
    await assert.rejects(fs.access(path.join(repo, 'done-a.txt')));
    await assert.rejects(fs.access(path.join(repo, 'done-b.txt')));
  } finally {
    await cleanup(root);
  }
});
