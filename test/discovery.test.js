import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { discoverSkills } from '../src/discovery.js';
import { makeTmpDir, writeSkill, cleanup } from './helpers.js';

test('discovers a root skill', async () => {
  const repo = await makeTmpDir();
  try {
    await writeSkill(repo, 'foo', { name: 'foo', description: 'Foo skill.' });
    const { skills, warnings } = await discoverSkills(repo);
    assert.equal(warnings.length, 0);
    assert.ok(skills.has('foo'));
    assert.equal(skills.get('foo').description, 'Foo skill.');
  } finally {
    await cleanup(repo);
  }
});

test('discovers a nested category skill by its flattened name', async () => {
  const repo = await makeTmpDir();
  try {
    await writeSkill(repo, 'category/misc/bar', { name: 'bar', description: 'Bar skill.' });
    const { skills } = await discoverSkills(repo);
    assert.ok(skills.has('bar'));
  } finally {
    await cleanup(repo);
  }
});

test('skips a skill with a missing frontmatter name, with a warning', async () => {
  const repo = await makeTmpDir();
  try {
    const dir = path.join(repo, 'broken');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), '---\ndescription: no name here\n---\nbody\n', 'utf8');

    const { skills, warnings } = await discoverSkills(repo);
    assert.equal(skills.size, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /missing required "name"/);
  } finally {
    await cleanup(repo);
  }
});

test('skips a skill with malformed frontmatter (no closing delimiter), with a warning', async () => {
  const repo = await makeTmpDir();
  try {
    const dir = path.join(repo, 'malformed');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), '---\nname: malformed\nno closing delimiter\n', 'utf8');

    const { skills, warnings } = await discoverSkills(repo);
    assert.equal(skills.size, 0);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /malformed frontmatter/);
  } finally {
    await cleanup(repo);
  }
});

test('detects a name collision between two skills and drops both', async () => {
  const repo = await makeTmpDir();
  try {
    await writeSkill(repo, 'one', { name: 'dup', description: 'First.' });
    await writeSkill(repo, 'two', { name: 'dup', description: 'Second.' });

    const { skills, warnings } = await discoverSkills(repo);
    assert.equal(skills.has('dup'), false);
    assert.ok(warnings.some((w) => w.includes('duplicate skill name "dup"')));
  } finally {
    await cleanup(repo);
  }
});
