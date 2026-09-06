import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';
import { parseFrontmatter } from '../src/frontmatter.js';
import { skillPath } from './helpers.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ponytailCommit = '0a4dd63ad4541f4f655c4108a295916f3c1d8fda';
const openaiCommit = '49f948faa9258a0c61caceaf225e179651397431';
const ponytailFamily = ['ponytail'];

async function readSkill(name) {
  const content = await fs.readFile(skillPath(repo, name, 'SKILL.md'), 'utf8');
  return { content, ...parseFrontmatter(content) };
}

test('the credited vendor skill is discoverable with a real operational body', async () => {
  const { skills, warnings } = await discoverSkills(path.join(repo, 'standalone'));
  assert.deepEqual(warnings, []);

  for (const name of ponytailFamily) {
    assert.ok(skills.has(name), 'missing discovered skill: ' + name);
    const { data, body } = await readSkill(name);
    assert.equal(data.name, name);
    assert.ok(String(data.description).trim(), name + ' needs a trigger description');
    assert.ok(body.trim().length > 80, name + ' needs an operational body');
  }
});

test('Ponytail is one credited vendor skill', async () => {
  const { skills } = await discoverSkills(path.join(repo, 'standalone'));
  for (const name of ponytailFamily) {
    const { data, body } = await readSkill(name);
    assert.equal(data.license, 'MIT');
    assert.equal(data.version ?? null, null, 'upstream vendor content must not gain a synthetic version');
    assert.equal(data.source, 'https://github.com/DietrichGebert/ponytail');
    assert.equal(data['source-commit'], ponytailCommit);
    assert.ok(body.includes('ponytail'));
    assert.equal(skills.get(name).name, name);
  }
});

test('provenance document pins external sources and promises no vendored-text dependency', async () => {
  const provenance = await fs.readFile(path.join(repo, 'VENDORED.md'), 'utf8');
  assert.match(provenance, new RegExp(ponytailCommit));
  assert.match(provenance, new RegExp(openaiCommit));
  assert.match(provenance, /DietrichGebert\/ponytail/);
  assert.match(provenance, /openai\/skills/);
  assert.match(provenance, /license/i);
  assert.match(provenance, /source-commit/i);
  assert.match(provenance, /No external source text is a dependency/);
  assert.doesNotMatch(provenance, /\| browser-control \|/i);
  assert.doesNotMatch(provenance, /\| github-workflow \|/i);
  // Plain-string patterns, not /.../ literals: an escaped \/ before the name
  // would read as a slash invocation to the retired-reference guard.
  assert.doesNotMatch(provenance, new RegExp('standalone/github-workflow/SKILL[.]md'));
  assert.doesNotMatch(provenance, new RegExp('pi-usage-maintenance|pi-setup-maintenance', 'i'));
});
