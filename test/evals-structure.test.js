import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

// Regression: the retired-name gate must catch both slash invocations in
// prose and inline-code references — a word-boundary-only pattern let
// whitespace-prefixed slashes through.
test('retired-name invocations are caught in prose and inline code', async () => {
  // Names come from the shared list rather than literals: this file is a
  // tracked file, and a literal retired name in it trips the catalogue's own
  // retired-reference scan.
  const RETIRED = JSON.parse(await readFile(path.join(repo, 'evals', 'retired-names.json'), 'utf8'));
  const [slashName, tickName] = [RETIRED[0], RETIRED[RETIRED.length - 1]];

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vskills-validate-'));
  const dir = path.join(tmp, 'standalone', 'fake-skill');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'SKILL.md'), [
    '---',
    'name: fake-skill',
    'version: 1.0.0',
    'description: A throwaway fixture skill that exists only to exercise the retired-name invocation gate inside validate-skills.',
    'recommended: false',
    '---',
    '',
    `First run /${slashName} against the failure, then shell out to \`${tickName}\` for the merge.`,
  ].join('\n'), 'utf8');

  const { violations } = await validateSkills(tmp);
  const retired = violations.filter((v) => v.rule === 'retired-name');
  assert.equal(retired.length, 1, `expected one offending line, got ${JSON.stringify(violations)}`);
});
