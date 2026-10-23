import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';
import { skillPath } from './helpers.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// #75: the consolidated catalogue. Seven core pipeline skills stay separate;
// the rest are independent disciplines. Three former standalone skills
// (gauntlet-loop, github-workflow, multi-agent-review) were cut here.
// #78 adds the manual model-throughput benchmark.
// Later additions: the merge loop (land), read-only and failure work
// (investigate, debug), session continuity (resume-work), the intent router
// (route), and the principles/ bucket the delivery skills compose.
const EXPECTED_KEPT = new Set([
  'ship',
  'grill',
  'issues',
  'snapshot',
  'setup-vskills',
  'ponytail',
  'push-handoff',
  'pr-review',
  'setup-obsidian',
  'audit',
  'delivery-constraints',
  'implementation-tdd',
  'subagent-delegation',
  'ai-subscription-unit-economics',
  'test-tps',
  'land',
  'investigate',
  'debug',
  'resume-work',
  'route',
  'principle-real-artifact',
  'principle-evidence-over-report',
  'principle-bounded-repair',
  'principle-named-constraints',
  'principle-independent-verdict',
]);

const CORE = new Set([
  'grill',
  'issues',
  'ship',
  'snapshot',
]);

// Every skill this repo has ever shipped under another name lives in
// evals/retired-names.json — the single source shared with
// scripts/validate-skills.mjs. A tracked file that still invokes one by /name
// or `name` advertises an `add <name>` that now fails. Plain historical prose
// (VENDORED.md's satellite sentence) is allowed; invocations are not.

// git ls-files, not a filesystem walk: CONTEXT/ holds working state and full
// repo copies (including worktrees of this repo) that must never be scanned,
// and gitignored worktree paths never appear here at all. third-party/ is
// vendored upstream text, not this catalogue, so a slash name in that tree
// is not an invocation this package ships.
function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: repo, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('CONTEXT/') && !line.startsWith('third-party/'));
}

test('the catalogue is exactly the 25 kept skills, with the 4 core skills separate', async () => {
  const { skills, warnings } = await discoverSkills(repo);
  assert.deepEqual(warnings, []);
  assert.deepEqual(new Set(skills.keys()), EXPECTED_KEPT);
  for (const name of CORE) {
    assert.ok(skills.has(name), `core skill is not a separate skill: ${name}`);
  }
});

test('every declared dependency resolves to a kept skill', async () => {
  // #76 mitigation: a dangling dependency silently uninstalls the depender,
  // so the catalogue itself must prove the graph is closed.
  const { skills } = await discoverSkills(repo);
  const dangling = [];
  for (const [name, skill] of skills) {
    for (const dep of skill.dependencies ?? []) {
      if (!skills.has(dep)) dangling.push(`${name} depends on missing skill ${dep}`);
    }
  }
  assert.deepEqual(dangling, []);
});

test("README's catalogue section names every kept skill and only discoverable ones", async () => {
  const readme = await fs.readFile(path.join(repo, 'README.md'), 'utf8');
  const section = readme.slice(
    readme.indexOf('## The skills'),
    readme.indexOf('## Skills from elsewhere'),
  );
  assert.ok(section.includes('## The skills'), 'README lost its skills catalogue section');
  const tokens = [...section.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1])
    .filter((token) => /^[a-z0-9][a-z0-9-]*$/.test(token));
  const { skills } = await discoverSkills(repo);
  for (const token of new Set(tokens)) {
    assert.ok(skills.has(token), `README catalogues undiscoverable skill: ${token}`);
  }
  for (const name of skills.keys()) {
    assert.ok(tokens.includes(name), `README catalogue omits kept skill: ${name}`);
  }
});

test('no tracked file invokes a retired skill by /name or `name`', async () => {
  const RETIRED = JSON.parse(await fs.readFile(path.join(repo, 'evals', 'retired-names.json'), 'utf8'));
  // This file once listed the retired names inline and stays excluded from
  // the scan rather than blessed by an exemption list that could rot.
  const self = 'test/catalogue.test.js';
  const offences = [];
  for (const file of trackedFiles()) {
    if (file === self) continue;
    // A tracked path missing from the workdir is a staged or unstaged
    // deletion that a commit will finish: it advertises nothing, so there is
    // nothing to scan. (git ls-files reads the index, which still lists such
    // paths until they are committed.)
    const content = await fs.readFile(path.join(repo, file), 'utf8').catch((error) => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
    if (content === null) continue;
    for (const name of RETIRED) {
      const slash = new RegExp(`(?<![\\w/-])/(${name})(?![\\w-])`);
      const backticked = new RegExp(`\`[^\`]*\\b(${name})\\b[^\`]*\``);
      if (slash.test(content)) offences.push(`${file}: slash invocation of retired skill ${name}`);
      if (backticked.test(content)) offences.push(`${file}: backticked reference to retired skill ${name}`);
    }
  }
  assert.deepEqual(offences, []);
});
