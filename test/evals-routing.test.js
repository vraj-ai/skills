import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';
import { buildIndex, scorePrompt } from '../scripts/run-evals.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Evals tier 2 (evals/README.md): a natural prompt must rank the intended
// skill top-1 over the whole catalogue, and a negative prompt must not rank
// the tempting-but-wrong skill top-1. A failure means fix the description's
// vocabulary, not the eval.
test('every routing case ranks its expected skill top-1', async () => {
  const { skills } = await discoverSkills(repo);
  const index = buildIndex(skills);
  const { cases } = JSON.parse(
    await fs.readFile(path.join(repo, 'evals', 'routing', 'cases.json'), 'utf8')
  );

  const misses = [];
  for (const c of cases) {
    assert.ok(skills.has(c.expect), `case "${c.prompt}" expects unknown skill ${c.expect}`);
    const top = scorePrompt(c.prompt, skills, index)[0][0];
    if (c.kind === 'negative' ? top === c.expect : top !== c.expect) {
      misses.push(`"${c.prompt}" -> ${top}, expected ${c.kind === 'negative' ? 'not-' : ''}${c.expect}`);
    }
  }
  assert.deepEqual(misses, [], misses.join('\n'));
});
