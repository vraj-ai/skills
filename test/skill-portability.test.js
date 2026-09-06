import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A skill body that hardcodes one vendor's directory layout, or the operator's
// own home directory, is unusable in any other harness. Skills must resolve
// CONTEXT/ and every script from the invoking repository root instead.
const FORBIDDEN = [
  /~\/\.claude\b/,
  /~\/\.omp\b/,
  /~\/\.opencode\b/,
  /\$HOME\b/,
  /\$\{HOME[}:]/,
  /(?<![\w/])\/Users\//,
  /(?<![\w/])\/home\/[a-z]/i,
];

// Exempted by name, with the reason. Nothing else may be added without one.
const EXEMPT = new Set([
  // setup-vskills' actual job is writing harness config files, so naming
  // harness config directories is its subject matter, not a portability leak.
  // It enumerates them as a table of harness -> destination and degrades
  // gracefully when a harness is absent.
  'standalone/setup-vskills/SKILL.md',
]);

// git ls-files, not a filesystem walk: CONTEXT/ holds working state and full
// repo copies (including worktrees of this repo) that must never be scanned.
function trackedSkillFiles() {
  return execFileSync('git', ['ls-files', '*/SKILL.md', '*/REFERENCE.md'], {
    cwd: repo,
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

test('skill bodies contain no harness-specific or absolute home paths', async () => {
  const files = trackedSkillFiles();
  assert.ok(files.length >= 15, `expected the kept skill set, got ${files.length} files`);
  assert.ok(!files.some((file) => file.startsWith('CONTEXT/')), 'CONTEXT/ must never be scanned');

  const offences = [];
  for (const file of files) {
    if (EXEMPT.has(file)) continue;
    const content = await fs.readFile(path.join(repo, file), 'utf8');
    content.split('\n').forEach((line, index) => {
      for (const pattern of FORBIDDEN) {
        if (pattern.test(line)) offences.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(offences, [], `portability leaks:\n${offences.join('\n')}`);
});

test('every exempted skill file exists and is still tracked', () => {
  const files = new Set(trackedSkillFiles());
  for (const exempt of EXEMPT) {
    assert.ok(files.has(exempt), `stale exemption: ${exempt}`);
  }
});
