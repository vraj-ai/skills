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
const initializer = skillPath(path.resolve(__dirname, '..'), 'setup-vskills', 'scripts', 'init-context.mjs');

test('context initializer creates the durable project architecture without overwriting it', async () => {
  const projectRoot = await makeTmpDir('vskills-context-');
  try {
    const first = await execFileAsync(process.execPath, [initializer, projectRoot]);
    assert.match(first.stdout, /created\s+AGENTS\.md/);
    // The initializer prints native path separators.
    assert.match(first.stdout, /created\s+CONTEXT[\\/]architecture\.md/);

    const agents = await fs.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf8');
    const architecture = await fs.readFile(path.join(projectRoot, 'CONTEXT', 'architecture.md'), 'utf8');
    assert.match(agents, /CONTEXT\/architecture\.md/);
    assert.match(architecture, /Locked Decisions/);
    assert.doesNotMatch(architecture, /progress.md|`goals`/);

    await fs.writeFile(path.join(projectRoot, 'AGENTS.md'), 'human instructions\n');
    const second = await execFileAsync(process.execPath, [initializer, projectRoot]);
    assert.match(second.stdout, /preserved\s+AGENTS\.md/);
    assert.equal(await fs.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf8'), 'human instructions\n');
  } finally {
    await cleanup(projectRoot);
  }
});
