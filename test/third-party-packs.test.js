import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function skillNames(root) {
  const names = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name === 'SKILL.md') names.push(path.basename(dir));
    }
  }
  await walk(root);
  return names;
}

test('vendored third-party packs are present and stay outside the vskills catalogue', async () => {
  const matt = await skillNames(path.join(repo, 'third-party/mattpocock/skills'));
  const addy = await skillNames(path.join(repo, 'third-party/addyosmani/skills'));
  const design = await fs.readFile(path.join(repo, 'third-party/frontend-design/SKILL.md'), 'utf8');

  assert.equal(matt.length, 38);
  assert.ok(matt.includes('ask-matt'));
  assert.equal(addy.length, 25);
  assert.ok(addy.includes('frontend-ui-engineering'));
  assert.ok(design.includes('name: frontend-design'));
  assert.ok(design.split('\n').length > 40, 'frontend-design needs a real body');
  assert.equal(matt.includes('design-an-interface'), false);
  assert.equal(addy.includes('design-an-interface'), false);

  const { skills, warnings } = await discoverSkills(repo);
  assert.deepEqual(warnings, []);
  for (const name of [...matt, ...addy, 'frontend-design']) {
    assert.equal(skills.has(name), false, `${name} must not join the vskills catalogue`);
  }
});
