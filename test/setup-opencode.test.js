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
const installer = path.resolve(__dirname, '..', 'setup-vskills', 'scripts', 'install-opencode.mjs');

test('OpenCode profile installer is idempotent and backs up conflicts', async () => {
  const configRoot = await makeTmpDir('opencode-profile-');
  try {
    const env = { ...process.env, OPENCODE_CONFIG_DIR: configRoot };
    const first = await execFileAsync(process.execPath, [installer], { env });
    assert.match(first.stdout, /installed\s+agent\/goals\.md/);
    await assert.doesNotReject(fs.access(path.join(configRoot, 'command', 'goal.md')));
    await assert.doesNotReject(fs.access(path.join(configRoot, 'command', 'council.md')));

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
