import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillPath } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');

async function read(...parts) {
  return fs.readFile(path.join(repo, ...parts), 'utf8');
}

async function readSkill(name, ...parts) {
  return fs.readFile(skillPath(repo, name, ...parts), 'utf8');
}

test('native workflow skills state durable context ownership', async () => {
  const [goals, council, setup] = await Promise.all([
    readSkill('goals', 'SKILL.md'),
    readSkill('council', 'SKILL.md'),
    readSkill('setup-vskills', 'SKILL.md'),
  ]);

  assert.match(goals, /One owner per artifact/);
  assert.match(goals, /CONTEXT\/progress\.md/);
  assert.match(goals, /goals` is the sole writer/);
  assert.match(council, /Council is read-only with respect to durable context/);
  assert.match(council, /never edits[\s\S]*backlog/);
  assert.match(setup, /`vskills` CLI never writes them\s+into a consumer repo/);
  assert.match(setup, /init-context\.mjs/);
  assert.match(setup, /AGENTS\.md/);
});

test('workflow skills use named one-level Worker Roles and host-neutral dispatch', async () => {
  const names = ['goals'];
  const docs = Object.fromEntries(await Promise.all(
    names.map(async (name) => [name, await readSkill(name, 'SKILL.md')]),
  ));

  docs.ship = await readSkill('ship', 'references', 'program.md');

  for (const content of Object.values(docs)) {
    assert.match(content, /Worker Roles/);
    assert.match(content, /one level\s+deep/i);
    assert.match(content, /Workers never spawn/i);
    assert.doesNotMatch(content, /~\/\.omp\b|Task API|opencode-go\/|openrouter\//i);
  }

  for (const name of ['ship', 'goals']) {
    for (const role of ['researcher', 'builder', 'reviewer', 'adversary', 'small-task']) {
      assert.match(docs[name], new RegExp(`\`${role}\``));
    }
    assert.doesNotMatch(docs[name], /run[\s\S]{0,60}(?:research|verify)[\s\S]{0,60}directly/i);
    assert.match(docs[name], phrase('Use `council` only for a genuinely contested fork'));
    assert.doesNotMatch(docs[name], /council-(?:grok|kimi|qwen|sol|gemini|deepseek|glm)\b/i);
  }

  assert.match(docs.ship, /Orchestrator/);
  assert.match(docs.ship, /never write the backlog, lock, handoff, or push/);
  assert.match(docs.ship, /Tracker closeout review/);
  assert.match(docs.ship, /gh pr comment/);
  assert.match(docs.goals, /only delivery orchestrator[\s\S]{0,100}backlog[\s\S]{0,100}push/i);
});

test('handoff compaction and delivery remain separate contracts', async () => {
  const [pushHandoff, readme] = await Promise.all([
    readSkill('push-handoff', 'SKILL.md'),
    read('README.md'),
  ]);

  assert.match(pushHandoff, /Handoff boundaries/);
  assert.match(pushHandoff, /A handoff never implies a push/);
  assert.match(pushHandoff, /remote SHA/);
  assert.match(readme, /push-handoff` is the explicit/);
});

// These skill docs are hard-wrapped prose, so a phrase assertion has to
// tolerate a line break falling anywhere inside it.
function phrase(text) {
  return new RegExp(text.split(' ')
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+'));
}

test('ship and goals share one state-label vocabulary', async () => {
  const [ship, goals] = await Promise.all([
    readSkill('ship', 'references', 'program.md'),
    readSkill('goals', 'SKILL.md'),
  ]);

  // Compare the two files against each other, not against a hardcoded list —
  // a status added to one pipeline and not the other is the actual hazard.
  const statuses = (doc) => new Set([...doc.matchAll(/goals:([a-z-]+)/g)].map((m) => m[1]));
  const shipStatuses = statuses(ship);

  assert.ok(shipStatuses.size >= 7, `ship declares only ${shipStatuses.size} statuses`);
  assert.deepEqual(shipStatuses, statuses(goals));
});

test('ship publishes native milestones without goals ceremony', async () => {
  const ship = await readSkill('ship', 'references', 'program.md');

  assert.match(ship, phrase('native GitHub Milestones'));

  // `gh` has no milestone subcommand, so the doc must not imply one exists.
  assert.match(ship, phrase('gh api repos/{owner}/{repo}/milestones'));
  assert.doesNotMatch(ship, /gh milestone/);

  // A resumed run must match closed milestones too; matching only open ones
  // creates a duplicate title after a gate closes one, which GitHub rejects.
  assert.match(ship, phrase('across open and closed milestones alike'));

  // `source_id` is state.mjs's attempt-cap grouping key, never a tracker link.
  assert.doesNotMatch(ship, /`source_id` is the link/);

  // The close rule has exactly one home, so the two copies cannot drift apart.
  assert.equal((ship.match(/close the milestone/gi) ?? []).length, 1);
});
