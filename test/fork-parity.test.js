import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillPath } from './helpers.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name, ...p) => fs.readFile(skillPath(repo, name, ...p), 'utf8');

// #30: `ship` and `goals` each carry their own copy of these modules, because a
// skill installs as a self-contained directory — `ship/` cannot import out of
// `goals/`. The duplication is therefore structural and staying, but nothing
// enforced it, so the copies were free to drift apart silently.

test('the two state.mjs copies are byte-identical', async () => {
  const [goals, ship] = await Promise.all([
    read('goals', 'scripts', 'state.mjs'),
    read('ship', 'scripts', 'state.mjs'),
  ]);

  // The README promises the pipelines "share one backlog format and one
  // state.mjs contract". A backlog written by either must be readable by both.
  assert.equal(ship, goals, 'ship/scripts/state.mjs has drifted from goals/scripts/state.mjs');
});

test('the two parallel runners diverge only on their approved differences', async () => {
  const [base, fork] = await Promise.all([
    read('goals', 'scripts', 'parallel.mjs'),
    read('ship-parallel', 'scripts', 'parallel.mjs'),
  ]);

  const baseLines = new Set(base.split('\n'));
  const forkLines = new Set(fork.split('\n'));
  const unique = [
    ...[...baseLines].filter((l) => !forkLines.has(l)),
    ...[...forkLines].filter((l) => !baseLines.has(l)),
  ].filter((l) => l.trim().length > 1); // ignore lone braces the hunks drag along

  // ship-parallel was forked deliberately so `goals` keeps two-reviewer review
  // while `ship` runs one. Those are the only concerns allowed to differ; a
  // change to any shared safety check must land in both copies.
  const approved = [
    /(goals|ship)\\\/\[A-Za-z/,              // branch-prefix guard
    /strictIntegrationBranch\s*=/,           // integration branch prefix
    /MAX_BATCH|maxBatch/,                    // batch bounds
    /process\.env\.REVIEWERS/,               // default reviewer list
    /reviewers\.length !== [12]/,            // one vs two T0 reviewers
    /T0 reviewers must be distinct/,         // goals-only distinct ids
    /T0 reviewers must use distinct model families/,
    /reviewers\.map\(\(reviewer\) => modelFamily/,
    /const guard =/,                         // contributor brief
  ];

  // Every pattern must earn its place: one that matches nothing is not a
  // constraint, it is a comment that looks like a constraint.
  for (const re of approved) {
    assert.ok(unique.some((line) => re.test(line)), `approved pattern matches nothing: ${re}`);
  }

  const unexpected = unique.filter((line) => !approved.some((re) => re.test(line)));
  assert.deepEqual(unexpected, [], 'unapproved drift between the parallel runners');
});

test('ship and ship-parallel agree that worktrees live under CONTEXT/worktrees/ship/<slug>/', async () => {
  const [ship, fork] = await Promise.all([
    read('ship', 'SKILL.md'),
    read('ship-parallel', 'SKILL.md'),
  ]);

  assert.match(ship, /CONTEXT\/worktrees\/ship\/<slug>\//);
  assert.match(
    fork,
    /git worktree add -b ship\/<slug>\/<id> CONTEXT\/worktrees\/ship\/<slug>\/<id>/,
  );
});
