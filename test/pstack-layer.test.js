import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';
import { skillPath } from './helpers.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function skill(name) {
  return fs.readFile(skillPath(repo, name, 'SKILL.md'), 'utf8');
}

test('verify-skills is project-local and pstack is not a catalogue skill', async () => {
  const { skills } = await discoverSkills(repo);
  assert.equal(skills.has('verify-skills'), false);
  assert.equal(skills.has('poteto-mode'), false);
  assert.equal(skills.has('ketchup'), false);
  assert.equal(skills.has('interrogate'), false);

  const verify = await fs.readFile(path.join(repo, '.cursor/skills/verify-skills/SKILL.md'), 'utf8');
  assert.match(verify, /^name: verify-skills$/m);
  assert.match(verify, /node scripts\/validate-skills\.mjs/);
  assert.match(verify, /npm test/);
});

test('ship runs poteto-mode inside and uses interrogate when no reviewer is configured', async () => {
  const ship = await skill('ship');
  assert.match(ship, /\/poteto-mode/);
  assert.match(ship, /inside this skill/);
  assert.match(ship, /\/interrogate/);
  assert.match(ship, /`land` still owns merged/);
});

test('grill keeps product questions and can hand off to interrogate', async () => {
  const grill = await skill('grill');
  assert.match(grill, /product intent/);
  assert.match(grill, /\/how/);
  assert.match(grill, /\/architect/);
  assert.match(grill, /\/interrogate/);
  assert.match(grill, /does not apply that verdict/);
});

test('issues names a verify-<app> feature when one exists', async () => {
  const issues = await skill('issues');
  assert.match(issues, /verify-<app>/);
  assert.match(issues, /features\/<feature>\.md/);
});

test('snapshot maps to ketchup and keeps the resume note', async () => {
  const snapshot = await skill('snapshot');
  assert.match(snapshot, /\/ketchup/);
  assert.match(snapshot, /head SHA/);
  assert.match(snapshot, /pause-safely does not replace it/);
});

test('route does not list poteto-mode as a destination', async () => {
  const route = await skill('route');
  assert.match(route, /inside `ship`/);
  const table = route.slice(route.indexOf('| Intent |'), route.indexOf('## The usual sequences'));
  assert.doesNotMatch(table, /poteto-mode|ketchup|interrogate/);
});
