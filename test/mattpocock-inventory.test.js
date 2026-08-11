import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mattpocockDir = path.resolve(__dirname, '..', 'mattpocock');

// Pinned upstream commit recorded in mattpocock/PROVENANCE.md.
const PINNED_COMMIT = '6acc160e4e0cd062dbbbd7a1b26ae92855edf07e';

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

test('provenance manifest is tracked and pins the v1.2.3 commit', async () => {
  const manifest = await fs.readFile(path.join(mattpocockDir, 'PROVENANCE.md'), 'utf8');
  assert.match(manifest, /Repository: https:\/\/github\.com\/mattpocock\/skills/);
  assert.match(manifest, /Release tag: `v1\.2\.3`/);
  assert.match(manifest, new RegExp(`Immutable commit \\(detached HEAD\\): \`${PINNED_COMMIT}\``));
});

test('the vendored Matt tree has no duplicate frontmatter names', async () => {
  const { skills, warnings } = await discoverSkills(mattpocockDir);
  assert.equal(warnings.length, 0, `unexpected warnings: ${warnings.join('\n')}`);
  // Sanity: every discovered skill declares a name we read back.
  for (const name of skills.keys()) {
    assert.ok(typeof name === 'string' && name.length > 0);
  }
});

test('upstream renames and moves are handled explicitly', async () => {
  // wizard moved from in-progress/ to engineering/ in v1.2.3
  assert.ok(await exists(path.join(mattpocockDir, 'engineering', 'wizard', 'SKILL.md')), 'engineering/wizard must exist');
  assert.ok(!(await exists(path.join(mattpocockDir, 'in-progress', 'wizard'))), 'in-progress/wizard must be removed');

  // writing-great-skills renamed to writing-for-agents in productivity/
  assert.ok(await exists(path.join(mattpocockDir, 'productivity', 'writing-for-agents', 'SKILL.md')), 'productivity/writing-for-agents must exist');
  assert.ok(!(await exists(path.join(mattpocockDir, 'productivity', 'writing-great-skills'))), 'productivity/writing-great-skills must be removed');
});

test('new upstream v1.2.3 productivity skills are vendored', async () => {
  for (const name of ['to-questionnaire', 'wait-what']) {
    assert.ok(await exists(path.join(mattpocockDir, 'productivity', name, 'SKILL.md')), `productivity/${name} must exist`);
  }
});

test('local-only and retained deprecated skills are preserved', async () => {
  const retained = [
    'personal/edit-article',
    'personal/obsidian-vault',
    'deprecated/design-an-interface',
    'deprecated/qa',
    'deprecated/request-refactor-plan',
    'deprecated/ubiquitous-language',
    'in-progress/batch-grill-me',
  ];
  for (const rel of retained) {
    assert.ok(await exists(path.join(mattpocockDir, rel, 'SKILL.md')), `retained ${rel} must exist`);
  }
});

test('every mirrored engineering/productivity/misc/in-progress skill carries its skill-local agents/openai.yaml', async () => {
  const expectedAgents = [
    'engineering/ask-matt',
    'engineering/code-review',
    'engineering/codebase-design',
    'engineering/diagnosing-bugs',
    'engineering/domain-modeling',
    'engineering/grill-with-docs',
    'engineering/implement',
    'engineering/improve-codebase-architecture',
    'engineering/prototype',
    'engineering/research',
    'engineering/resolving-merge-conflicts',
    'engineering/setup-matt-pocock-skills',
    'engineering/tdd',
    'engineering/to-spec',
    'engineering/to-tickets',
    'engineering/triage',
    'engineering/wayfinder',
    'engineering/wizard',
    'productivity/grill-me',
    'productivity/grilling',
    'productivity/handoff',
    'productivity/teach',
    'productivity/to-questionnaire',
    'productivity/wait-what',
    'productivity/writing-for-agents',
    'in-progress/claude-handoff',
    'in-progress/loop-me',
    'in-progress/setup-ts-deep-modules',
    'in-progress/writing-beats',
    'in-progress/writing-fragments',
    'in-progress/writing-shape',
    'misc/git-guardrails-claude-code',
    'misc/migrate-to-shoehorn',
    'misc/scaffold-exercises',
    'misc/setup-pre-commit',
  ];
  // personal/, deprecated/, and in-progress/batch-grill-me are local/retained
  // and are not expected to carry upstream agents/openai.yaml.
  for (const rel of expectedAgents) {
    assert.ok(await exists(path.join(mattpocockDir, rel, 'agents', 'openai.yaml')), `${rel}/agents/openai.yaml must exist`);
  }
});