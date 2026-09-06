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
const EXPECTED_KEPT = new Set([
  'ship',
  'goals',
  'council',
  'council-adversary',
  'grill',
  'issues',
  'snapshot',
  'setup-vskills',
  'ponytail',
  'push-handoff',
  'pr-review',
  'setup-obsidian',
  'herdr-orchestrator',
  'audit',
  'delivery-constraints',
  'implementation-tdd',
  'subagent-delegation',
  'ai-subscription-unit-economics',
]);

const CORE = new Set([
  'grill',
  'issues',
  'ship',
  'goals',
  'snapshot',
  'council',
  'council-adversary',
]);

// Every skill this repo has ever shipped under another name. A tracked file
// that still invokes one by /name or `name` advertises an `add <name>` that
// now fails. Plain historical prose (VENDORED.md's satellite sentence) is
// allowed; invocations are not.
const RETIRED = [
  'loop-engineer',
  'browser-control',
  'hands-free',
  'pi-setup-maintenance',
  'pi-usage-maintenance',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
  'ponytail-review',
  'legacy-planner',
  'legacy-coder',
  'legacy-debugger',
  'legacy-reviewer',
  'github-projects-pipeline',
  'profile-gated-delivery',
  'specialist-profiles',
  'parallel-subagent-implementation',
  'subagent-batch-implementation',
  'shared-worktree-delegation',
  'shared-worktree-safety',
  'ticket-implementation-tdd',
  'provider-integration-tdd',
  'codebase-audit',
  'invariant-evidence-review',
  'controlled-ticket-delivery',
  'state-driven-pipeline-recovery',
  'gauntlet-loop',
  'github-workflow',
  'multi-agent-review',
];

// git ls-files, not a filesystem walk: CONTEXT/ holds working state and full
// repo copies (including worktrees of this repo) that must never be scanned,
// and gitignored worktree paths never appear here at all.
function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: repo, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('CONTEXT/'));
}

test('the catalogue is exactly the 18 kept skills, with the 7 core skills separate', async () => {
  const { skills, warnings } = await discoverSkills(repo);
  assert.deepEqual(warnings, []);
  assert.deepEqual(new Set(skills.keys()), EXPECTED_KEPT);
  for (const name of CORE) {
    assert.ok(skills.has(name), `core skill is not a separate skill: ${name}`);
  }
});

test('herdr-orchestrator stays manual-only and opt-in', async () => {
  const { skills } = await discoverSkills(repo);
  assert.ok(skills.has('herdr-orchestrator'), 'herdr-orchestrator is missing from the catalogue');
  assert.equal(
    skills.get('herdr-orchestrator').recommended,
    false,
    'herdr-orchestrator must not be recommended',
  );
  const content = await fs.readFile(skillPath(repo, 'herdr-orchestrator', 'SKILL.md'), 'utf8');
  assert.match(content, /disable-model-invocation:\s*true/);
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
  // This file is its own retired-name fixture, so it is excluded from the
  // scan rather than blessed by an exemption list that could rot.
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
