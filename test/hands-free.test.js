import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../src/frontmatter.js';
import { skillPath } from './helpers.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Skill docs are hard-wrapped, so a phrase assertion has to tolerate a line
// break falling anywhere inside it. Same helper as test/context-contract.test.js.
function phrase(text) {
  return new RegExp(
    text
      .split(' ')
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+'),
  );
}

test('hands-free is user-invoked and leaves git delivery to the human', async () => {
  const raw = await fs.readFile(skillPath(repo, 'hands-free', 'SKILL.md'), 'utf8');
  const { data, body } = parseFrontmatter(raw);

  assert.equal(data.name, 'hands-free');
  assert.equal(data['disable-model-invocation'], true);
  assert.match(body, /judgement stop/i);
  assert.match(body, /event-waits|event wait/i);
  assert.match(body, phrase('do not run `git commit`, `git push`'));
  assert.match(body, phrase('Do not force-push'));
  assert.match(body, phrase('GitHub reports `MERGED`'));
  assert.match(body, /physical impossibility/i);
  assert.match(body, /gh pr create/);
  assert.doesNotMatch(body, /disable-model-invocation:\s*false/);
});
