import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillPath } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');

async function read(...parts) {
  return fs.readFile(path.join(repo, ...parts), 'utf8');
}

async function readSkill(name, ...parts) {
  return fs.readFile(skillPath(repo, name, ...parts), 'utf8');
}

test('handoff compaction and delivery remain separate contracts', async () => {
  const [pushHandoff, readme] = await Promise.all([
    readSkill('push-handoff', 'SKILL.md'),
    read('README.md'),
  ]);

  assert.match(pushHandoff, /Handoff boundaries/);
  assert.match(pushHandoff, /A handoff never implies a push/);
  assert.match(pushHandoff, /remote SHA/);
  assert.match(readme, /push-handoff` is the explicit/);
});

