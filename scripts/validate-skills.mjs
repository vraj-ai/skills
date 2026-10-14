#!/usr/bin/env node
// Tier 1 of the evals framework (evals/README.md): structural validation for
// every SKILL.md in the repo. Deterministic and free — the checks a skill can
// fail before any model ever sees it:
//
//   - frontmatter parses and carries name, description, version
//   - frontmatter name equals the containing directory's basename
//   - version is semver-shaped, recommended is boolean
//     (version is not required on vendored skills — frontmatter `source:`
//     marks upstream content, which must not gain a synthetic version)
//   - every declared dependency resolves to another discovered skill
//   - the body invokes no retired skill name by /name or `name`
//
// Imported by test/evals-structure.test.js for CI, and runnable standalone:
//
//   node scripts/validate-skills.mjs          # exit 1 on any violation
//   node scripts/validate-skills.mjs --json   # machine-readable report

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { discoverSkills } from '../src/discovery.js';
import { parseFrontmatter } from '../src/frontmatter.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Skill names that shipped and were later cut. Invoking one advertises a skill
// that no longer exists. evals/retired-names.json is the single source —
// test/catalogue.test.js scans tracked files with the same list.

const SEMVER = /^\d+\.\d+\.\d+$/;
const MIN_DESCRIPTION = 40;
const MAX_DESCRIPTION = 1024;

export async function validateSkills(root = repoRoot) {
  const { skills, warnings } = await discoverSkills(root);
  const violations = warnings.map((warning) => ({ file: null, rule: 'discovery', detail: warning }));

  // Retired-name invocations in bodies. Frontmatter fields are free to mention
  // history; bodies may not invoke. The retired list is global history, so it
  // always loads from this repo — even when root is a fixture directory.
  const RETIRED = JSON.parse(
    await readFile(path.join(repoRoot, 'evals', 'retired-names.json'), 'utf8')
  );
  const invocation = new RegExp(`/(?:${RETIRED.join('|')})\\b|\`(?:${RETIRED.join('|')})\\b`);

  for (const [name, skill] of skills) {
    const rel = path.relative(root, skill.dir);
    const file = path.join(rel, 'SKILL.md');
    const { data, body } = parseFrontmatter(await readFile(path.join(skill.dir, 'SKILL.md'), 'utf8'));
    const vendored = typeof data.source === 'string' && data.source.length > 0;

    if (name !== path.basename(skill.dir)) {
      violations.push({
        file, rule: 'name-matches-dir',
        detail: `frontmatter name "${name}" != directory "${path.basename(skill.dir)}"`,
      });
    }
    if (!skill.version) {
      if (!vendored) {
        violations.push({ file, rule: 'version', detail: 'missing version field' });
      }
    } else if (!SEMVER.test(skill.version)) {
      violations.push({ file, rule: 'version', detail: `version "${skill.version}" is not semver` });
    }
    if (!skill.description || skill.description.length < MIN_DESCRIPTION) {
      violations.push({
        file, rule: 'description',
        detail: `description too short (${(skill.description || '').length} < ${MIN_DESCRIPTION} chars) — a thin description is a routing false-negative`,
      });
    } else if (skill.description.length > MAX_DESCRIPTION) {
      violations.push({
        file, rule: 'description',
        detail: `description too long (${skill.description.length} > ${MAX_DESCRIPTION} chars) — routing context is a budget`,
      });
    }
    for (const dep of skill.dependencies ?? []) {
      if (!skills.has(dep)) {
        violations.push({ file, rule: 'dependencies', detail: `depends on missing skill "${dep}"` });
      }
    }

    body.split('\n').forEach((line, i) => {
      if (invocation.test(line)) {
        violations.push({ file, rule: 'retired-name', detail: `line ${i + 1}: invokes a retired skill` });
      }
    });
  }

  return { violations, skillCount: skills.size };
}

async function main() {
  const { violations, skillCount } = await validateSkills();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ skillCount, violations }, null, 2));
  } else {
    for (const v of violations) {
      console.error(`${v.file ?? '(discovery)'}: ${v.rule}: ${v.detail}`);
    }
    console.log(`validate-skills: ${skillCount} skills, ${violations.length} violation(s)`);
  }
  process.exit(violations.length === 0 ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
