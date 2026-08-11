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
const initializer = path.resolve(__dirname, '..', 'setup-vskills', 'scripts', 'init-context.mjs');

test('context initializer creates the durable project architecture without overwriting it', async () => {
  const projectRoot = await makeTmpDir('vskills-context-');
  try {
    const first = await execFileAsync(process.execPath, [initializer, projectRoot]);
    assert.match(first.stdout, /created\s+AGENTS\.md/);
    assert.match(first.stdout, /created\s+CONTEXT\/architecture\.md/);
    assert.match(first.stdout, /created\s+CONTEXT\/progress\.md/);

    const agents = await fs.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf8');
    const architecture = await fs.readFile(path.join(projectRoot, 'CONTEXT', 'architecture.md'), 'utf8');
    const progress = await fs.readFile(path.join(projectRoot, 'CONTEXT', 'progress.md'), 'utf8');
    const gitignore = await fs.readFile(path.join(projectRoot, '.gitignore'), 'utf8');
    assert.match(agents, /CONTEXT\/architecture\.md/);
    assert.match(architecture, /Locked Decisions/);
    assert.match(progress, /Current milestone: Not started/);
    assert.match(gitignore, /CONTEXT\/goals\/\*\/backlog\.jsonl/);
    assert.doesNotMatch(gitignore, /CONTEXT\/architecture\.md/);

    await fs.writeFile(path.join(projectRoot, 'AGENTS.md'), 'human instructions\n');
    const second = await execFileAsync(process.execPath, [initializer, projectRoot]);
    assert.match(second.stdout, /preserved\s+AGENTS\.md/);
    assert.equal(await fs.readFile(path.join(projectRoot, 'AGENTS.md'), 'utf8'), 'human instructions\n');
    assert.match(second.stdout, /up-to-date\s+\.gitignore/);
  } finally {
    await cleanup(projectRoot);
  }
});
