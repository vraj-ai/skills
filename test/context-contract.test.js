import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');

async function read(...parts) {
  return fs.readFile(path.join(repo, ...parts), 'utf8');
}

test('native workflow skills state durable context ownership', async () => {
  const [goals, council, setup] = await Promise.all([
    read('goals', 'SKILL.md'),
    read('council', 'SKILL.md'),
    read('setup-vskills', 'SKILL.md'),
  ]);

  assert.match(goals, /One owner per artifact/);
  assert.match(goals, /CONTEXT\/progress\.md/);
  assert.match(goals, /goals` is the sole writer/);
  assert.match(council, /Council is read-only with respect to durable context/);
  assert.match(council, /never edits[\s\S]*backlog/);
  assert.match(setup, /`vskills` CLI never writes them\s+into a consumer repo/);
});

test('handoff compaction and delivery remain separate contracts', async () => {
  const [handoff, pushHandoff, readme] = await Promise.all([
    read('mattpocock', 'productivity', 'handoff', 'SKILL.md'),
    read('push-handoff', 'SKILL.md'),
    read('README.md'),
  ]);

  assert.match(handoff, /temporary directory/);
  assert.doesNotMatch(handoff, /git\s+(commit|push)|commit and push|push work/);
  assert.match(pushHandoff, /Handoff boundaries/);
  assert.match(pushHandoff, /A handoff never implies a push/);
  assert.match(pushHandoff, /remote SHA/);
  assert.match(readme, /\/handoff` then `\/push-handoff/);
});
