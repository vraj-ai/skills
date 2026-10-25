#!/usr/bin/env node
// Checks ship records against the repo (format in ../references/record.md).
//
//   node ship-record.mjs          # every open record (any phase but done)
//   node ship-record.mjs <slug>   # one record, whatever its phase
//
// Prints each record's phase, Updated line, Next, and whether the recorded
// branch still points at the recorded head. Exit 1 when a record is missing a
// field or names an unknown phase or size; a moved head is reported, not fatal.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PHASES = ['context', 'design', 'issues', 'build', 'review', 'land', 'done', 'blocked'];
const SIZES = ['small', 'medium', 'feature'];

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function field(text, name) {
  return text.match(new RegExp(`^- ${name}:[ \\t]*(.*)$`, 'm'))?.[1].trim() || null;
}

function parseRecord(text) {
  const record = {
    phase: field(text, 'Phase'),
    size: field(text, 'Size'),
    updated: field(text, 'Updated'),
    next: field(text, 'Next'),
  };
  const problems = [];
  for (const name of ['phase', 'size', 'updated', 'next']) {
    if (!record[name]) problems.push(`missing ${name[0].toUpperCase()}${name.slice(1)}`);
  }
  if (record.phase && !PHASES.includes(record.phase)) problems.push(`unknown phase "${record.phase}"`);
  if (record.size && !SIZES.includes(record.size)) problems.push(`unknown size "${record.size}"`);
  const at = record.updated?.match(/^(.+?),\s*(\S+) at ([0-9a-f]{7,40})\b/);
  if (record.updated && !at) problems.push('Updated is not "<ISO time>, <branch> at <head SHA>, <worktree>"');
  if (at) [, record.time, record.branch, record.head] = at;
  return { record, problems };
}

function headState({ branch, head }) {
  if (!branch) return 'unknown';
  const now = git(['rev-parse', '--verify', '--quiet', `${branch}^{commit}`]);
  if (!now) return `branch ${branch} missing`;
  return now.startsWith(head) ? 'current' : `moved to ${now.slice(0, 12)}`;
}

function main() {
  const common = git(['rev-parse', '--git-common-dir']);
  if (!common) {
    console.error('not inside a git repository');
    process.exit(2);
  }
  const dir = path.join(path.resolve(common), 'vskills', 'ship');
  const slug = process.argv[2];
  let files;
  try {
    files = slug ? [`${slug.replace(/\.md$/, '')}.md`] : readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    files = [];
  }

  let bad = false;
  let shown = 0;
  for (const file of files) {
    let text;
    try {
      text = readFileSync(path.join(dir, file), 'utf8');
    } catch {
      console.log(`${file}: no record at ${dir}`);
      bad = true;
      continue;
    }
    const { record, problems } = parseRecord(text);
    if (!slug && record.phase === 'done' && problems.length === 0) continue;
    shown += 1;
    console.log(`${file.replace(/\.md$/, '')}  phase=${record.phase}  size=${record.size}  head: ${headState(record)}`);
    console.log(`  updated: ${record.updated}`);
    console.log(`  next: ${record.next}`);
    for (const problem of problems) console.log(`  problem: ${problem}`);
    if (problems.length) bad = true;
  }
  if (!slug && shown === 0) console.log(`no open records in ${dir}`);
  process.exit(bad ? 1 : 0);
}

main();
