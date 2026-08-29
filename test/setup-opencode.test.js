import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, makeTmpDir } from './helpers.js';
import { skillPath } from './helpers.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');
const installer = skillPath(repo, 'setup-vskills', 'scripts', 'install-opencode.mjs');
const ompInstaller = skillPath(repo, 'setup-vskills', 'scripts', 'install-omp.mjs');
const harnessInstaller = skillPath(repo, 'setup-vskills', 'scripts', 'install-harness.mjs');
const profileRoot = path.join(repo, 'harness', 'opencode');
const ompProfileRoot = path.join(repo, 'harness', 'omp', 'agent');

test('OpenCode profile installer is idempotent and backs up conflicts', async () => {
  const configRoot = await makeTmpDir('opencode-profile-');
  try {
    await fs.mkdir(path.join(configRoot, 'command'), { recursive: true });
    await fs.writeFile(path.join(configRoot, 'command', 'council.md'), `---
description: Run independent multi-model research, debate, voting, or scoped review.
agent: goals
---

Load the \`council\` skill and run the appropriate council protocol for
$ARGUMENTS. Keep goals as the sole orchestrator and forbid subagents from
delegating further. If no objective is supplied, ask for one before spawning
the council.
`);
    const env = { ...process.env, OPENCODE_CONFIG_DIR: configRoot };
    const first = await execFileAsync(process.execPath, [installer], { env });
    assert.match(first.stdout, /retired\s+command\/council\.md/);
    assert.match(first.stdout, /installed\s+agent\/goals\.md/);
    assert.match(first.stdout, /installed\s+agent\/council\.md/);
    assert.match(first.stdout, /installed\s+agent\/council-gemini\.md/);
    assert.match(first.stdout, /installed\s+agent\/council-deepseek\.md/);
    await assert.doesNotReject(fs.access(path.join(configRoot, 'command', 'goal.md')));
    assert.equal(
      await fs.readFile(path.join(configRoot, 'agent', 'goals.md'), 'utf8'),
      await fs.readFile(path.join(profileRoot, 'agent', 'goals.md'), 'utf8'),
    );
    await assert.rejects(fs.access(path.join(configRoot, 'command', 'council.md')));

    const second = await execFileAsync(process.execPath, [installer], { env });
    assert.match(second.stdout, /up-to-date\s+agent\/goals\.md/);

    await fs.writeFile(path.join(configRoot, 'agent', 'goals.md'), 'local change\n');
    const third = await execFileAsync(process.execPath, [installer], { env });
    assert.match(third.stdout, /updated\s+agent\/goals\.md/);
    const backups = await fs.readdir(path.join(configRoot, '.vskills-backup', 'agent'));
    assert.ok(backups.some((name) => name.startsWith('goals.md-')));
  } finally {
    await cleanup(configRoot);
  }
});

test('omp profile installer copies all 10 Role files, is idempotent, and backs up conflicts', async () => {
  const agentsDir = await makeTmpDir('omp-agents-');
  const expectedRoles = [
    'adversary.md',
    'builder.md',
    'goals.md',
    'grill.md',
    'issues.md',
    'researcher.md',
    'reviewer.md',
    'ship.md',
    'small-task.md',
    'snapshot.md',
  ];

  try {
    const env = { ...process.env, OMP_AGENTS_DIR: agentsDir };
    const first = await execFileAsync(process.execPath, [ompInstaller], { env });

    assert.equal(expectedRoles.length, 10);
    for (const role of expectedRoles) {
      assert.match(first.stdout, new RegExp(`installed\\s+${role}`));
      const installedPath = path.join(agentsDir, role);
      await assert.doesNotReject(fs.access(installedPath));
      assert.equal(
        await fs.readFile(installedPath, 'utf8'),
        await fs.readFile(path.join(ompProfileRoot, role), 'utf8'),
      );
    }

    const second = await execFileAsync(process.execPath, [harnessInstaller, 'omp'], { env });
    for (const role of expectedRoles) {
      assert.match(second.stdout, new RegExp(`up-to-date\\s+${role}`));
    }

    await fs.writeFile(path.join(agentsDir, 'goals.md'), 'local omp goals edit\n');
    const third = await execFileAsync(process.execPath, [ompInstaller], { env });
    assert.match(third.stdout, /updated\s+goals\.md/);
    const backups = await fs.readdir(path.join(agentsDir, '.vskills-backup'));
    assert.ok(backups.some((name) => name.startsWith('goals.md-')));
  } finally {
    await cleanup(agentsDir);
  }
});

test('a made-up harness name does not fail as an allowlist miss and runs research', async () => {
  const madeUpHarness = 'custom-agent-runner-xyz';
  const result = await execFileAsync(process.execPath, [harnessInstaller, madeUpHarness]);
  assert.match(result.stdout, /Researched harness 'custom-agent-runner-xyz'/);
  assert.doesNotMatch(result.stderr, /unknown harness/i);
  assert.doesNotMatch(result.stderr, /allowlist/i);

  const { installHarness, researchHarness } = await import(
    path.join(repo, 'standalone', 'setup-vskills', 'scripts', 'install-harness.mjs')
  );

  const plan = researchHarness('arbitrary-future-harness');
  assert.equal(plan.harness, 'arbitrary-future-harness');
  assert.ok(Array.isArray(plan.supportedInvocations));
  assert.ok(plan.supportedInvocations.includes('grill'));
  assert.ok(plan.supportedInvocations.includes('issues'));
  assert.ok(plan.supportedInvocations.includes('ship'));
  assert.ok(plan.supportedInvocations.includes('snapshot'));

  const installResult = await installHarness('arbitrary-future-harness');
  assert.equal(installResult.status, 'researched');
  assert.equal(installResult.harness, 'arbitrary-future-harness');
});
