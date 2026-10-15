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
//   - every relative markdown link inside a skill directory resolves
//   - every skill named in route's intent table is a catalogue skill
//   - the body invokes no retired skill name by /name or `name`
//   - .cursor/skills/*/SKILL.md (project-local, not catalogue) passes the
//     same frontmatter and relative-link checks
//
// Imported by test/evals-structure.test.js for CI, and runnable standalone:
//
//   node scripts/validate-skills.mjs          # exit 1 on any violation
//   node scripts/validate-skills.mjs --json   # machine-readable report

import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
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
const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;

function stripFences(text) {
  return text.replace(/```[\s\S]*?```/g, '');
}

async function markdownFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await markdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// Relative links only. Absolute URLs and same-page anchors are not files
// this repo is claiming to contain.
async function relativeLinkViolations(root, file, text) {
  const violations = [];
  for (const match of stripFences(text).matchAll(LINK)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const target = raw.split('#')[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    try {
      await stat(resolved);
    } catch {
      violations.push({
        file: path.relative(root, file),
        rule: 'cross-reference',
        detail: `relative link "${raw}" does not resolve`,
      });
    }
  }
  return violations;
}

// The intent table's skill column is a cross-reference into the catalogue.
// pstack names belong in the prose under the table, not in this column.
function routeTableTargets(body) {
  const targets = [];
  let inTable = false;
  for (const line of body.split('\n')) {
    if (/^\|\s*Intent\s*\|\s*Skill\s*\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.trim().startsWith('|')) {
      inTable = false;
      continue;
    }
    if (/^\|\s*:?-{3,}/.test(line)) continue;
    const skillCell = line.split('|')[2] ?? '';
    for (const match of skillCell.matchAll(/`([a-z0-9-]+)`/g)) targets.push(match[1]);
  }
  return targets;
}

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

    const skillMd = path.join(skill.dir, 'SKILL.md');
    for (const md of await markdownFiles(skill.dir)) {
      const text = md === skillMd ? body : await readFile(md, 'utf8');
      violations.push(...await relativeLinkViolations(root, md, text));
    }

    if (name === 'route') {
      for (const target of routeTableTargets(body)) {
        if (!skills.has(target)) {
          violations.push({
            file, rule: 'cross-reference',
            detail: `route table names "${target}", which is not a catalogue skill`,
          });
        }
      }
    }
  }

  await lintProjectLocalSkills(root, violations, invocation);

  return { violations, skillCount: skills.size };
}

async function lintProjectLocalSkills(root, violations, invocation) {
  const cursorSkills = path.join(root, '.cursor', 'skills');
  let entries;
  try {
    entries = await readdir(cursorSkills, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(cursorSkills, entry.name);
    const skillMd = path.join(dir, 'SKILL.md');
    let content;
    try {
      content = await readFile(skillMd, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        violations.push({
          file: path.relative(root, dir),
          rule: 'frontmatter',
          detail: 'project-local skill directory has no SKILL.md',
        });
        continue;
      }
      throw err;
    }

    let parsed;
    try {
      parsed = parseFrontmatter(content);
    } catch (err) {
      violations.push({
        file: path.relative(root, skillMd),
        rule: 'frontmatter',
        detail: err.message,
      });
      continue;
    }

    const { data, body } = parsed;
    const file = path.relative(root, skillMd);
    if (typeof data.name !== 'string' || data.name !== entry.name) {
      violations.push({
        file, rule: 'name-matches-dir',
        detail: `frontmatter name "${data.name ?? ''}" != directory "${entry.name}"`,
      });
    }
    const description = typeof data.description === 'string' ? data.description : '';
    if (description.length < MIN_DESCRIPTION || description.length > MAX_DESCRIPTION) {
      violations.push({
        file, rule: 'description',
        detail: `description length ${description.length} is outside ${MIN_DESCRIPTION}-${MAX_DESCRIPTION}`,
      });
    }
    if (data.version !== undefined && data.version !== '' && !SEMVER.test(String(data.version))) {
      violations.push({ file, rule: 'version', detail: `version "${data.version}" is not semver` });
    }
    body.split('\n').forEach((line, i) => {
      if (invocation.test(line)) {
        violations.push({ file, rule: 'retired-name', detail: `line ${i + 1}: invokes a retired skill` });
      }
    });
    for (const md of await markdownFiles(dir)) {
      const text = md === skillMd ? body : await readFile(md, 'utf8');
      violations.push(...await relativeLinkViolations(root, md, text));
    }
  }
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
