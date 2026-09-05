import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSelection, UnknownSkillsError } from '../src/selection.js';

function skillsMap(entries) {
  return new Map(entries.map(([name, recommended]) => [name, { name, recommended }]));
}

test('with no flag and nothing stored, the recommended tier is the default', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', true]]);
  const { names, toPersist } = resolveSelection({ skills, selection: null, stored: null });
  assert.deepEqual([...names].sort(), ['a', 'c']);
  assert.deepEqual([...toPersist].sort(), ['a', 'c']);
});

test('--all selects every discovered skill regardless of tier, and persists the "all" sentinel', () => {
  const skills = skillsMap([['a', true], ['b', false]]);
  const { names, toPersist } = resolveSelection({ skills, selection: { all: true }, stored: null });
  assert.deepEqual([...names].sort(), ['a', 'b']);
  assert.equal(toPersist, 'all');
});

test('a stored "all" sentinel selects every discovered skill, including ones added since', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', false]]);
  const { names, toPersist } = resolveSelection({ skills, selection: null, stored: 'all' });
  assert.deepEqual([...names].sort(), ['a', 'b', 'c']);
  assert.equal(toPersist, null);
});

test('--only selects exactly the named skills', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', false]]);
  const { names, toPersist } = resolveSelection({ skills, selection: { only: ['b', 'c'] }, stored: null });
  assert.deepEqual([...names].sort(), ['b', 'c']);
  assert.deepEqual(toPersist, ['b', 'c']);
});

test('--only with an unknown skill name is rejected, not silently dropped', () => {
  const skills = skillsMap([['a', true]]);
  assert.throws(
    () => resolveSelection({ skills, selection: { only: ['a', 'nope'] }, stored: null }),
    (err) => {
      assert.ok(err instanceof UnknownSkillsError);
      assert.deepEqual(err.names, ['nope']);
      assert.match(err.message, /nope/);
      return true;
    }
  );
});

test('with no flag, a stored selection is honoured and not rewritten', () => {
  const skills = skillsMap([['a', true], ['b', false]]);
  const { names, toPersist } = resolveSelection({ skills, selection: null, stored: ['b'] });
  assert.deepEqual([...names], ['b']);
  assert.equal(toPersist, null);
});

test('an explicit flag overrides and rewrites a stored selection', () => {
  const skills = skillsMap([['a', true], ['b', false]]);
  const { names, toPersist } = resolveSelection({ skills, selection: { all: true }, stored: ['a'] });
  assert.deepEqual([...names].sort(), ['a', 'b']);
  assert.equal(toPersist, 'all');
});

test('an existing install with nothing stored is migrated: recommended tier plus whatever is already installed', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', false]]);
  const { names, toPersist } = resolveSelection({ skills, selection: null, stored: null, installedNames: ['b'] });
  assert.deepEqual([...names].sort(), ['a', 'b']);
  assert.deepEqual([...toPersist].sort(), ['a', 'b']);
});

test('a fresh machine (nothing stored, nothing installed) still gets just the recommended tier', () => {
  const skills = skillsMap([['a', true], ['b', false]]);
  const { names, toPersist } = resolveSelection({ skills, selection: null, stored: null, installedNames: [] });
  assert.deepEqual([...names], ['a']);
  assert.deepEqual([...toPersist], ['a']);
});
