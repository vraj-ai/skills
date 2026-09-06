import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSelection, UnknownSkillsError } from '../src/selection.js';
import { interpretSelectionAnswer, parseNameList } from '../src/prompt-selection.js';

function skillsMap(entries) {
  return new Map(entries.map(([name, recommended]) => [name, { name, recommended }]));
}

test('with no flag and nothing stored, the recommended tier is the default', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', true]]);
  const { names, toPersist } = resolveSelection({ skills, selection: null, stored: null });
  assert.deepEqual([...names].sort(), ['a', 'c']);
  assert.equal(toPersist, 'recommended');
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

test('--recommended persists the "recommended" sentinel, not a frozen name snapshot', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', true]]);
  const { names, toPersist } = resolveSelection({ skills, selection: { recommended: true }, stored: null });
  assert.deepEqual([...names].sort(), ['a', 'c']);
  assert.equal(toPersist, 'recommended');
});

test('a stored "recommended" sentinel resolves to the current recommended tier, including skills added since', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', true]]);
  const { names, toPersist } = resolveSelection({ skills, selection: null, stored: 'recommended' });
  assert.deepEqual([...names].sort(), ['a', 'c']);
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
      assert.ok(err instanceof UnknownSkillsError);
      assert.match(err.message, /resolved selection is empty/);
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
    UnknownSkillsError
  );
});

test('a catalogue with no recommended skill still throws on plain init (or a picker\'s bare Enter), instead of retiring everything', () => {
  const skills = skillsMap([['a', false], ['b', false]]);
  assert.throws(
    () => resolveSelection({ skills, selection: { recommended: true }, stored: null }),
    (err) => {
      assert.ok(err instanceof UnknownSkillsError);
      assert.match(err.message, /resolved selection is empty/);
      return true;
    }
  );
});

test('invariant: no input to resolveSelection ever produces an empty selected set when skills exist', () => {
  const withRecommended = skillsMap([['a', true], ['b', false]]);
  const noneRecommended = skillsMap([['a', false], ['b', false]]);
  const inputs = [
    { skills: withRecommended, selection: null, stored: null },
    { skills: withRecommended, selection: { all: true }, stored: null },
    { skills: withRecommended, selection: { recommended: true }, stored: null },
    { skills: withRecommended, selection: null, stored: 'all' },
    { skills: withRecommended, selection: null, stored: ['a'] },
    { skills: withRecommended, selection: { all: true }, stored: ['a'] },
    { skills: noneRecommended, selection: { all: true }, stored: null },
  ];
  for (const input of inputs) {
    const { names } = resolveSelection(input);
    assert.ok(names.size > 0, `expected a non-empty selection for ${JSON.stringify(input)}`);
  }
  // { skills: noneRecommended, selection: { recommended: true } } is covered
  // by its own test above: it must throw, not silently resolve to empty.
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
  assert.equal(toPersist, 'recommended', 'a fresh machine stays subscribed to the tier rather than freezing today\'s members');
});

// Regression for the P1 composition bug: on a pre-selection install (a
// populated manifest, no `selection` key in config), bin/vskills.js's
// picker fired under the same `!flag && interactive && stored == null`
// condition as resolveSelection's migration branch, and a bare Enter at
// that picker ALWAYS returned a flag ({ recommended: true }) — so the flag
// resolveSelection saw was never null, the migration branch (installed ∪
// recommended) was unreachable on any TTY, and an upgrading user who just
// pressed Enter had everything outside the tier silently retired.
//
// This wires the exact real path: `interpretSelectionAnswer('')` (what the
// picker's readline handler feeds into `flag` on bare Enter) straight into
// `resolveSelection`, against a manifest carrying many pre-selection
// installed skills. Before the fix, interpretSelectionAnswer('') returned
// `{ recommended: true }` and this failed (only the tier survived). After
// the fix it returns `null`, resolveSelection takes its no-flag migration
// branch, and every installed skill survives.
test('regression (M1-6 P1): the picker\'s bare-Enter answer must not retire a pre-selection install down to just the recommended tier', () => {
  const skills = skillsMap([['a', true], ['b', false], ['c', false], ['d', false]]);
  const installedNames = ['a', 'b', 'c', 'd']; // pre-selection install: everything discovered is on disk
  const bareEnterFlag = interpretSelectionAnswer(''); // exactly what the picker hands `flag`
  const { names } = resolveSelection({ skills, selection: bareEnterFlag, stored: null, installedNames });
  for (const name of installedNames) {
    assert.ok(names.has(name), `expected "${name}" to survive a bare-Enter init, but it was retired`);
  }
});
