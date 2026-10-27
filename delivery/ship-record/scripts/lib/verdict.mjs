// Verdict currency for a ship record.
//
// A verdict is a review from a context that did not write the code. It covers a
// patch, not a branch: the patch-id of the whole diff under review. Any change
// to that patch needs a fresh verdict, including a change to a test, a doc, or
// lint config, because documentation here is executable skill behaviour.
//
// Everything in this module fails closed. A revision that does not resolve, a
// diff that is empty, a missing patch-id, or a git failure all mean "not
// verified", never "assume it is fine".
import { execFileSync } from 'node:child_process';

const SHA = /^[0-9a-f]{7,40}$/;
const PATCH_ID = /^[0-9a-f]{40}$/;

export class VerdictError extends Error {
  constructor(message, code = 3) {
    super(message);
    this.name = 'VerdictError';
    this.exitCode = code;
  }
}

function git(cwd, args, { input } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      input,
      encoding: 'utf8',
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = String(error.stderr || error.message).trim().split('\n')[0];
    throw new VerdictError(`git ${args[0]} failed: ${detail}`, 2);
  }
}

export function resolveCommit(cwd, revision) {
  if (typeof revision !== 'string' || revision.length === 0) {
    throw new VerdictError('a revision is required', 2);
  }
  let sha;
  try {
    sha = execFileSync('git', ['rev-parse', '--verify', '--quiet', `${revision}^{commit}`], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new VerdictError(`cannot resolve revision "${revision}" in this repository, so it is unverified`);
  }
  if (!SHA.test(sha)) throw new VerdictError(`revision "${revision}" did not resolve to a commit`);
  return sha;
}

// The patch-id of the full diff from the merge base of base and head to head.
// Flags are pinned so two machines with different git config compute the same
// id: no colour, no external diff, no textconv, and --stable for file order.
export function patchId(cwd, base, head) {
  const baseSha = resolveCommit(cwd, base);
  const headSha = resolveCommit(cwd, head);
  if (baseSha === headSha) {
    throw new VerdictError(`"${base}" and "${head}" are the same commit, so there is no diff to verify`);
  }
  const diff = git(cwd, [
    '-c', 'core.pager=cat',
    'diff', '--no-color', '--no-ext-diff', '--no-textconv', `${baseSha}...${headSha}`,
  ]);
  if (diff.trim().length === 0) {
    throw new VerdictError(`the diff ${base}...${head} is empty, so there is nothing to verify`);
  }
  const output = git(cwd, ['patch-id', '--stable'], { input: diff }).trim();
  const id = output.split(/\s+/)[0];
  if (!PATCH_ID.test(id) || /^0+$/.test(id)) {
    throw new VerdictError(`git patch-id did not return a usable id for ${base}...${head}`);
  }
  return { base: baseSha, head: headSha, patchId: id };
}

// A reviewer is a separate context. "self", an empty id, or the author marker
// cannot be a verdict, so this rejects them at the boundary instead of letting
// a later reader wonder what "self" meant.
export function parseReviewer(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = text.match(/^(agent|bot|human):(.+)$/);
  if (!match) {
    throw new VerdictError(`reviewer must be agent:<id>, bot:<id>, or human:<id>, got "${text}"`, 2);
  }
  const id = match[2].trim();
  if (!id || /^(self|author)$/i.test(id)) {
    throw new VerdictError('a verdict needs a reviewer that did not write the code', 2);
  }
  return { kind: match[1], id };
}

export function formatReviewer(reviewer) {
  return `${reviewer.kind}:${reviewer.id}`;
}

// A stored verdict is current when its patch-id equals the patch-id of the
// current head against the same base. No file-category exception exists.
export function judge(cwd, verdict) {
  if (!verdict || !verdict.patchId || !verdict.base || !verdict.at) {
    return { state: 'unknown', detail: 'the record has no verdict for this PR' };
  }
  let current;
  try {
    current = patchId(cwd, verdict.base, 'HEAD');
  } catch (error) {
    return { state: 'unverified', detail: error.message };
  }
  if (current.patchId === verdict.patchId) {
    return { state: 'current', current };
  }
  return {
    state: 'stale',
    current,
    detail: `the patch changed since ${verdict.by} reviewed ${verdict.at.slice(0, 12)}`,
  };
}
