#!/usr/bin/env node
// Reads and checks ship records, and records verdicts for a PR (format in
// ../references/record.md). Called by ship, land, snapshot, and resume-work;
// see ../SKILL.md.
//
//   node ship-record.mjs                    # every open record (any phase but done)
//   node ship-record.mjs <slug>             # one record, whatever its phase
//   node ship-record.mjs verdict add <slug> --pr N --by <kind:id> --at <rev> [--base <rev>]
//   node ship-record.mjs verdict check <slug> --pr N
//   node ship-record.mjs attest <slug>
//   node ship-record.mjs check <slug> [--require head]
//
// Reads print the record's phase, Updated line, Next, and whether the recorded
// branch still points at the recorded head. Exit 1 when a record is missing a
// field, names an unknown phase or size, or a verdict is malformed; exit 2 when
// the slug is a path, the arguments are wrong, or the command runs outside a
// repository; exit 3 when a required verdict is unknown or stale. A moved head
// is reported, not fatal, so a listing can show every record.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VerdictError, formatReviewer, judge, parseReviewer, patchId } from './lib/verdict.mjs';
import { findVerdict, upsertVerdict } from './lib/verdicts-table.mjs';

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
    peak: field(text, 'Peak'),
    updated: field(text, 'Updated'),
    next: field(text, 'Next'),
  };
  const problems = [];
  for (const name of ['phase', 'size', 'updated', 'next']) {
    if (!record[name]) problems.push(`missing ${name[0].toUpperCase()}${name.slice(1)}`);
  }
  if (record.phase && !PHASES.includes(record.phase)) problems.push(`unknown phase "${record.phase}"`);
  if (record.size && !SIZES.includes(record.size)) problems.push(`unknown size "${record.size}"`);
  if (record.peak && !SIZES.includes(record.peak)) problems.push(`unknown peak "${record.peak}"`);
  // Peak is the high-water mark of Size, so a later edit cannot shed phases the
  // task already needed by relabelling itself smaller.
  const rank = (value) => (SIZES.includes(value) ? SIZES.indexOf(value) : -1);
  if (rank(record.peak) > rank(record.size)) {
    problems.push(`size ${record.size} is below the recorded peak ${record.peak}`);
  }
  // A small task has no design fork and no product question, so it cannot sit
  // in a phase that only exists to settle one. Finding one is the signal to
  // raise Size, not to keep the label.
  if (record.size === 'small' && ['context', 'design', 'issues'].includes(record.phase)) {
    problems.push(`size small cannot sit in phase ${record.phase}: raise Size first`);
  }
  const at = record.updated?.match(/^(\d{4}-\d{2}-\d{2}T\S+),\s*(\S+) at ([0-9a-f]{7,40}),\s*(\S.*)$/);
  if (record.updated && (!at || Number.isNaN(Date.parse(at[1])))) {
    problems.push('Updated is not "<ISO time>, <branch> at <head SHA>, <worktree>"');
  } else if (at) {
    [, record.time, record.branch, record.head] = at;
  }
  return { record, problems };
}

function headState({ branch, head }) {
  if (!branch) return 'unknown';
  const now = git(['rev-parse', '--verify', '--quiet', `${branch}^{commit}`]);
  if (!now) return `branch ${branch} missing`;
  return now.startsWith(head) ? 'current' : `moved to ${now.slice(0, 12)}`;
}

function recordDir() {
  const common = git(['rev-parse', '--git-common-dir']);
  if (!common) throw new VerdictError('not inside a git repository', 2);
  return path.join(path.resolve(common), 'vskills', 'ship');
}

function recordPath(dir, rawSlug) {
  const slug = rawSlug?.replace(/\.md$/, '');
  if (slug !== undefined && (!slug || slug === '..' || path.basename(slug) !== slug)) {
    throw new VerdictError(`slug "${rawSlug}" must be a record name, not a path`, 2);
  }
  return { slug, file: slug ? path.join(dir, `${slug}.md`) : null };
}

// Atomic replace: a crash leaves the previous record intact. On Windows a
// rename can fail briefly while another process holds the file open.
function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, text, 'utf8');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      renameSync(tmp, file);
      return;
    } catch (error) {
      if (attempt === 4) {
        rmSync(tmp, { force: true });
        throw new VerdictError(`could not replace ${file}: ${error.message} (temp file removed)`, 1);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
    }
  }
}

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) throw new VerdictError(`unexpected argument "${arg}"`, 2);
    const key = arg.slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new VerdictError(`--${key} needs a value`, 2);
    }
    options[key] = value;
    i += 1;
  }
  return options;
}

function requireOption(options, name) {
  const value = options[name];
  if (value === undefined) throw new VerdictError(`--${name} is required`, 2);
  return value;
}

function readRecord(dir, slug) {
  const { file } = recordPath(dir, slug);
  if (!file) throw new VerdictError('a record name is required for this command', 2);
  try {
    return { file, text: readFileSync(file, 'utf8') };
  } catch {
    throw new VerdictError(`no record for "${slug}" at ${dir}`, 1);
  }
}

// The model asserts its prose is true at this head; the tool writes the four
// header facts so no hand-typed SHA can drift from the repository.
function attestCommand(argv) {
  const [rawSlug] = argv;
  const dir = recordDir();
  const { slug } = recordPath(dir, rawSlug);
  if (!slug) throw new VerdictError('a record name is required for attest', 2);
  const { file, text } = readRecord(dir, slug);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch || branch === 'HEAD') {
    throw new VerdictError('attest needs a checked-out branch, not a detached HEAD', 2);
  }
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}']);
  const worktree = git(['rev-parse', '--show-toplevel']);
  if (!head || !worktree) throw new VerdictError('could not read the current commit', 2);

  const previous = parseRecord(text).record;
  if (previous.phase === 'done') {
    throw new VerdictError(`${slug} is done; a finished record needs no attestation`, 1);
  }
  // Size may rise as work turns out larger, and Peak keeps the high-water
  // mark. The checker rejects a Size below that mark.
  const rank = (value) => (SIZES.includes(value) ? SIZES.indexOf(value) : -1);
  const recordedPeak = previous.peak;
  const peak = rank(previous.size) >= rank(recordedPeak) ? previous.size : recordedPeak;

  const updated = `${new Date().toISOString()}, ${branch} at ${head}, ${worktree}`;
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => /^- Updated:/.test(line));
  if (index === -1) throw new VerdictError('the record has no Updated line to attest', 1);
  lines[index] = `- Updated: ${updated}`;
  const peakIndex = lines.findIndex((line) => /^- Peak:/.test(line));
  if (!recordedPeak && peak) {
    lines.splice(index, 0, `- Peak: ${peak}`);
  } else if (peakIndex !== -1 && peak !== recordedPeak) {
    lines[peakIndex] = `- Peak: ${peak}`;
  }
  writeAtomic(file, `${lines.join('\n').replace(/\s*$/, '')}\n`);
  console.log(`${slug}  phase=${previous.phase}  size=${previous.size}  head: ${headState({ branch, head })}`);
  console.log(`  updated: ${updated}`);
  return 0;
}

function checkCommand(argv) {
  const rawSlug = argv.find((arg) => !arg.startsWith('--'));
  const requireIndex = argv.indexOf('--require');
  const requirement = requireIndex === -1 ? null : argv[requireIndex + 1];
  if (requireIndex !== -1 && requirement !== 'head') {
    throw new VerdictError('--require supports only "head"', 2);
  }
  const dir = recordDir();
  const { slug } = recordPath(dir, rawSlug);
  if (!slug) throw new VerdictError('a record name is required for check', 2);
  const { text } = readRecord(dir, slug);
  const { record, problems } = parseRecord(text);
  const state = headState(record);
  console.log(`${slug}  phase=${record.phase}  size=${record.size}  head: ${state}`);
  for (const problem of problems) console.log(`  problem: ${problem}`);
  if (problems.length) return 1;
  if (requirement === 'head' && state !== 'current') {
    console.log(`  unmet: this step needs a record attested at the current head (${state})`);
    return 3;
  }
  return 0;
}

function verdictCommand(argv) {
  const [action, rawSlug, ...rest] = argv;
  const dir = recordDir();
  const { slug } = recordPath(dir, rawSlug);
  if (!slug) throw new VerdictError('a record name is required for a verdict', 2);
  const { file, text } = readRecord(dir, slug);
  const options = parseOptions(rest);
  const pr = Number(requireOption(options, 'pr'));
  if (!Number.isInteger(pr) || pr <= 0) throw new VerdictError('--pr must be a pull request number', 2);

  if (action === 'add') {
    const reviewer = parseReviewer(requireOption(options, 'by'));
    const base = requireOption(options, 'base');
    const reviewed = patchId(process.cwd(), base, requireOption(options, 'at'));
    const verdict = {
      pr,
      by: formatReviewer(reviewer),
      at: reviewed.head,
      base: reviewed.base,
      patchId: reviewed.patchId,
    };
    writeAtomic(file, upsertVerdict(text, verdict));
    console.log(`${slug}  pr=#${pr}  verdict=recorded  by=${verdict.by}  at=${verdict.at.slice(0, 12)}  patch-id=${verdict.patchId}`);
    return 0;
  }

  if (action === 'check') {
    const verdict = findVerdict(text, pr);
    const result = judge(process.cwd(), verdict);
    if (result.state !== 'current') {
      console.log(`${slug}  pr=#${pr}  verdict=${result.state}  ${result.detail ?? ''}`.trim());
      return 3;
    }
    console.log(`${slug}  pr=#${pr}  verdict=current  patch-id=${verdict.patchId}`);
    return 0;
  }

  throw new VerdictError(`unknown verdict action "${action}" (expected add or check)`, 2);
}

function listingCommand(rawSlug) {
  const dir = recordDir();
  const { slug } = recordPath(dir, rawSlug);
  let files;
  try {
    files = slug ? [`${slug}.md`] : readdirSync(dir).filter((f) => f.endsWith('.md'));
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
  return bad ? 1 : 0;
}

function main(argv) {
  if (argv[0] === 'verdict') {
    return verdictCommand(argv.slice(1));
  }
  if (argv[0] === 'attest') {
    return attestCommand(argv.slice(1));
  }
  if (argv[0] === 'check') {
    return checkCommand(argv.slice(1));
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('ship-record <slug> | ship-record | ship-record verdict add|check <slug> --pr N ...');
    return 0;
  }
  return listingCommand(argv[0]);
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  if (error instanceof VerdictError) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  if (error instanceof Error && error.exitCode) {
    console.error(error.message);
    process.exit(error.exitCode);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
