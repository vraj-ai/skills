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
const profileRoot = path.join(repo, 'harness', 'opencode');

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
