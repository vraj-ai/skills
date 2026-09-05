import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const EXPECTED_RECOMMENDED = new Set([
  'ship',
  'goals',
  'council',
  'council-adversary',
  'grill',
  'issues',
  'snapshot',
  'setup-vskills',
  'ponytail',
]);

test('exactly the nine recommended skills are marked recommended: true', async () => {
  const { skills, warnings } = await discoverSkills(repoRoot);
  assert.equal(warnings.length, 0);

  const actualRecommended = new Set(
    [...skills.values()].filter((skill) => skill.recommended).map((skill) => skill.name)
  );

  assert.deepEqual(actualRecommended, EXPECTED_RECOMMENDED);
});
