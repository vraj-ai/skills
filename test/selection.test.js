import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSelection, UnknownSkillsError, EmptySelectionError } from '../src/selection.js';
import { parseNameList } from '../src/prompt-selection.js';

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

test('--only , (an empty list, as CLI parsing produces from a bare comma) is rejected, not treated as "select nothing"', () => {
  const skills = skillsMap([['a', true], ['b', false]]);
  assert.deepEqual(parseNameList(','), []); // what CLI parsing of `--only ,` actually produces
  assert.throws(
    () => resolveSelection({ skills, selection: { only: [] }, stored: null }),
    (err) => {
      assert.ok(err instanceof EmptySelectionError);
      assert.match(err.message, /at least one skill name/);
      return true;
    }
  );
});

test('the picker\'s pick-then-empty-Enter path also produces an empty --only list, and is rejected the same way', () => {
  const skills = skillsMap([['a', true], ['b', false]]);
  // Mirrors bin/vskills.js's promptForSelection pick-branch: `{ only: parseNameList(namesRaw) }`.
  const pickedNames = parseNameList('');
  assert.throws(
    () => resolveSelection({ skills, selection: { only: pickedNames }, stored: null }),
    EmptySelectionError
  );
});

test('invariant: no input to resolveSelection ever produces an empty selected set when skills exist', () => {
  const skills = skillsMap([['a', true], ['b', false]]);
  const inputs = [
    { selection: null, stored: null },
    { selection: { all: true }, stored: null },
    { selection: { recommended: true }, stored: null },
    { selection: null, stored: 'all' },
    { selection: null, stored: ['a'] },
    { selection: { all: true }, stored: ['a'] },
  ];
  for (const input of inputs) {
    const { names } = resolveSelection({ skills, ...input });
    assert.ok(names.size > 0, `expected a non-empty selection for ${JSON.stringify(input)}`);
  }
  // The one deliberately-empty stored case is an existing selection of
  // nothing — distinct from the --only bug, and out of scope here.
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
