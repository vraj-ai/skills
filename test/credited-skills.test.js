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
const required = [
  'browser-control',
  'github-workflow',
  'pi-usage-maintenance',
  'pi-setup-maintenance',
];
const ponytailFamily = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];

async function readSkill(name) {
  const content = await fs.readFile(skillPath(repo, name, 'SKILL.md'), 'utf8');
  return { content, ...parseFrontmatter(content) };
}

test('required credited skills are discoverable and manual-only skills stay opt-in', async () => {
  const { skills, warnings } = await discoverSkills(path.join(repo, 'standalone'));
  assert.deepEqual(warnings, []);

  for (const name of [...required, ...ponytailFamily]) {
    assert.ok(skills.has(name), 'missing discovered skill: ' + name);
    const { data, body } = await readSkill(name);
    assert.equal(data.name, name);
    assert.ok(String(data.description).trim(), name + ' needs a trigger description');
    assert.ok(body.trim().length > 80, name + ' needs an operational body');
  }

  for (const name of required) {
    const { data } = await readSkill(name);
    assert.equal(data['disable-model-invocation'], true, name + ' must be manual-only');
  }
});

test('Ponytail is one complete, credited family rather than duplicate local names', async () => {
  const { skills } = await discoverSkills(path.join(repo, 'standalone'));
  assert.equal(new Set(ponytailFamily).size, ponytailFamily.length);
  for (const name of ponytailFamily) {
    const { data, body } = await readSkill(name);
    assert.equal(data.license, 'MIT');
    assert.equal(data.version ?? null, null, 'upstream vendor content must not gain a synthetic version');
    assert.equal(data.source, 'https://github.com/DietrichGebert/ponytail');
    assert.equal(data['source-commit'], ponytailCommit);
    assert.ok(body.includes('ponytail') || name === 'ponytail-gain' || name === 'ponytail-help');
    assert.equal(skills.get(name).name, name);
  }
});

test('manual workflow triggers and safety contracts are focused', async () => {
  const browser = await readSkill('browser-control');
  const github = await readSkill('github-workflow');
  const usage = await readSkill('pi-usage-maintenance');
  const setup = await readSkill('pi-setup-maintenance');

  assert.equal(browser.data.source, 'local');
  assert.equal(browser.data['source-commit'], '2a1e1155497bcea1c561c6415e801ca1790e83e5');
  assert.equal(browser.data.attribution, 'Vraj / vraj-ai');
  assert.equal(browser.data.license, 'MIT');
  assert.equal(browser.data.version, '1.0.0');
  assert.match(browser.data.description, /explicitly asks/i);
  assert.match(browser.body, /connector, API, or CLI/i);
  assert.match(browser.body, /visible page state/i);
  assert.match(browser.body, /read it back/i);
  assert.match(browser.body, /untrusted data/i);
  assert.match(browser.body, /cookies/i);
  assert.match(browser.body, /secrets|passwords|tokens/i);
  assert.match(browser.body, /destructive actions|external writes/i);
  assert.doesNotMatch(browser.body, /openai-bundled|browser-client|node_repl|agent\.browsers|plugin:\/\//i);

  assert.equal(github.data.source, 'local');
  assert.equal(github.data['source-commit'], '2a1e1155497bcea1c561c6415e801ca1790e83e5');
  assert.equal(github.data.attribution, 'Vraj / vraj-ai');
  assert.equal(github.data.license, 'MIT');
  assert.equal(github.data.version, '1.0.0');
  assert.match(github.body, /Authority and scope/);
  assert.match(github.body, /Orient a repository or pull request/);
  assert.match(github.body, /Review comments and requested changes/);
  assert.match(github.body, /CI failures/);
  assert.match(github.body, /Commit, push, and pull request/);
  assert.match(github.body, /explicitly authorizes/i);
  assert.match(github.body, /connector, API, and CLI/i);
  assert.match(github.body, /Never merge or force-push/i);
  assert.doesNotMatch(github.body, /plugin|gh-address-comments|gh-fix-ci|yeet|\.\.\/.*SKILL\.md/i);

  assert.match(usage.body, /JSONL.*source of truth/i);
  assert.match(usage.body, /observed.*estimates/i);
  assert.match(usage.body, /atomic rename/i);
  assert.match(usage.body, /Never commit, push/i);
  assert.equal(usage.data.license, 'MIT');

  assert.match(setup.body, /manual-only/i);
  assert.match(setup.body, /backup/i);
  assert.match(setup.body, /no duplicate local\s+names/i);
  assert.match(setup.body, /rollback/i);
  assert.match(setup.body, /Do not commit or push/i);
  assert.equal(setup.data.license, 'MIT');
});

test('provenance document pins external sources and local baseline', async () => {
  const provenance = await fs.readFile(path.join(repo, 'VENDORED.md'), 'utf8');
  assert.match(provenance, new RegExp(ponytailCommit));
  assert.match(provenance, new RegExp(openaiCommit));
  assert.match(provenance, /DietrichGebert\/ponytail/);
  assert.match(provenance, /openai\/skills/);
  assert.match(provenance, /license/i);
  assert.match(provenance, /source-commit/i);
  assert.match(provenance, /Browser-control replacement/);
  assert.match(provenance, /inspiration\s+only/i);
  assert.match(provenance, /no OpenAI source text/i);
  assert.doesNotMatch(provenance, /\| browser-control \|/i);
  assert.match(provenance, /GitHub workflow/);
  assert.match(provenance, /original, complete, manual-only/i);
  assert.doesNotMatch(provenance, /\| github-workflow \|/i);
});
