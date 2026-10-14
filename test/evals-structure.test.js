import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSkills } from '../scripts/validate-skills.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Evals tier 1 (evals/README.md): every SKILL.md is structurally sound —
// frontmatter, naming, description budget, closed dependency graph, no
// retired-name invocations.
test('every skill passes structural validation', async () => {
  const { violations, skillCount } = await validateSkills(repo);
  assert.ok(skillCount >= 25, `expected the kept skill set, found ${skillCount}`);
  assert.deepEqual(violations, [], violations.map((v) => `${v.file}: ${v.detail}`).join('\n'));
});
