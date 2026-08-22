#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null) return fallback;
  return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

async function atomicJson(target, value) {
  const dir = path.dirname(target);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, target);
}

function run(command, args, { cwd, logFile, allowFailure = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', async (code) => {
      const output = Buffer.concat(chunks).toString('utf8');
      if (logFile) await writeFile(logFile, output, 'utf8');
      if (code !== 0 && !allowFailure) {
        reject(new Error(`${command} ${args.join(' ')} exited ${code}\n${output}`));
        return;
      }
      resolve({ code, output });
    });
  });
}

async function git(repo, args, options = {}) {
  return run('git', ['-C', repo, ...args], options);
}

async function shell(command, cwd, logFile) {
  return run('/bin/sh', ['-lc', command], { cwd, logFile, allowFailure: true });
}

function parseManifest(raw) {
  const items = raw.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line, index) => {
    const parts = line.split('|');
    if (parts.length < 4) fail(`manifest line ${index + 1} must be <id>|<branch>|<model>|<task prompt>`);
    const [name, branch, model, ...prompt] = parts;
    if (!/^[A-Za-z0-9._-]+$/.test(name)) fail(`manifest line ${index + 1} has unsafe id: ${name}`);
    if (!/^ship\/[A-Za-z0-9._/-]+$/.test(branch) || branch.includes('..')) fail(`manifest line ${index + 1} has unsafe branch: ${branch}`);
    if (!model.includes('/')) fail(`manifest line ${index + 1} model must include a provider: ${model}`);
    return { name, branch, model, prompt: prompt.join('|').trim() };
  });
  if (items.length === 0) fail('manifest has no items');
  const maxBatch = Math.min(Number.parseInt(process.env.MAX_BATCH ?? '4', 10), 8);
  if (!Number.isInteger(maxBatch) || maxBatch < 1) fail('MAX_BATCH must be an integer from 1 to 8');
  if (items.length > maxBatch) fail(`manifest has ${items.length} items; MAX_BATCH is ${maxBatch}`);
  if (new Set(items.map((item) => item.name)).size !== items.length) fail('manifest item ids must be unique');
  return items;
}

function parseJsonArrayLine(line, label) {
  const match = line.match(new RegExp(`^${label}:\\s*(.+)$`, 'i'));
  if (!match) return { valid: false, value: [] };
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed)
      ? { valid: true, value: parsed }
      : { valid: false, value: [] };
  } catch {
    return { valid: false, value: [] };
  }
}

function reviewRecord(reviewer, result) {
  const lines = result.output.trimEnd().split('\n').map((line) => line.trim());
  const footer = lines.slice(-3);
  const verdict = footer[0]?.match(/^VERDICT:\s*(PASS|FAIL)$/i);
  const findings = parseJsonArrayLine(footer[1] ?? '', 'FINDINGS');
  const followups = parseJsonArrayLine(footer[2] ?? '', 'FOLLOWUPS');
  const findingsValid = findings.valid && findings.value.every((finding) => (
    finding
    && typeof finding === 'object'
    && !Array.isArray(finding)
    && /^P[0-3]$/i.test(finding.severity)
    && ['file', 'trigger', 'wrong_behavior'].every((key) => typeof finding[key] === 'string' && finding[key].trim())
  ));
  return {
    reviewer,
    exit: result.code,
    verdict: verdict ? verdict[1].toUpperCase() : null,
    formatValid: footer.length === 3 && Boolean(verdict) && findingsValid && followups.valid,
    findings: findings.value,
    followups: followups.value,
  };
}

async function reviewSnapshot(worktree) {
  const head = (await git(worktree, ['rev-parse', 'HEAD'])).output.trim();
  const index = (await git(worktree, ['write-tree'])).output.trim();
  const listing = (await git(worktree, ['ls-tree', '-rz', 'HEAD'])).output;
  const hashes = [];
  for (const entry of listing.split('\0').filter(Boolean)) {
    const match = entry.match(/^(\d+)\s+(\w+)\s+[0-9a-f]+\t(.+)$/s);
    if (!match || match[2] !== 'blob') continue;
    const [, mode, , relativePath] = match;
    let content;
    try {
      content = mode === '120000'
        ? Buffer.from(await readFile(path.join(worktree, relativePath), 'utf8'))
        : await readFile(path.join(worktree, relativePath));
    } catch (error) {
      hashes.push(`${relativePath}:missing:${error.code}`);
      continue;
    }
    const hash = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    hashes.push(`${relativePath}:${hash}`);
  }
  return { head, index, files: hashes.join('\n') };
}

function modelFamily(model) {
  const id = model.split('/').at(-1).toLowerCase();
  if (id.includes('glm')) return 'glm';
  if (id.includes('grok')) return 'grok';
  if (id.includes('kimi')) return 'kimi';
  if (id.includes('qwen')) return 'qwen';
  if (id.includes('gpt-5.6-sol')) return 'gpt-5.6-sol';
  return id;
}

const REVIEW_RUBRIC = `QUALITY PASS, after correctness. Three lenses. over-build: reinvented stdlib, a dependency for what the platform ships, an abstraction with one implementation, a wrapper that only delegates, config nobody sets. slop: a comment restating the line below it, a defensive try/catch on a path that cannot fail, a cast that silences the compiler instead of fixing the type, nesting where a guard clause would return early, code whose shape does not match the file it was added to. structure: a special case bolted into a flow that does not own it, feature logic in a shared path, a bespoke helper duplicating one this repo already has, a file this diff pushed past the size the rest of the tree keeps. One line per finding: <file>:<line>: <lens>: <what to cut>. <replacement>. A finding is admissible only when it names the replacement: a stdlib function, an existing symbol in this repo, a native platform feature, or 'delete, nothing replaces it'. Without a named replacement it is taste, and taste does not block a merge. An admissible over-build or structure finding is P1 and blocks the merge; slop is P2. Cap the quality pass at 5 findings, biggest cut first, and print 'net: -<N> lines possible.' (or 'Lean already.') on its own line IMMEDIATELY BEFORE the VERDICT line, never after FOLLOWUPS: the contract parses the last three lines and a trailing net line would displace VERDICT. One runnable check per piece of non-trivial logic is the required minimum and is never an over-build finding. Under-build stays P0/P1: missing trust-boundary validation, data-loss handling, security, accessibility, or an unmet acceptance criterion.`;

const [repoArg, worktreeArg, manifestArg] = process.argv.slice(2);
if (!repoArg || !worktreeArg || !manifestArg) {
  fail('usage: parallel.mjs <repo-root> <worktree-root> <manifest>');
}

const repo = path.resolve(repoArg);
const worktreeRoot = path.resolve(repo, worktreeArg);
const manifest = path.resolve(manifestArg);
const defaultOpenCode = path.join(os.homedir(), '.opencode', 'bin', 'opencode');
const opencode = process.env.OPENCODE_BIN
  || (await access(defaultOpenCode).then(() => defaultOpenCode).catch(() => null))
  || 'opencode';
const defaultTestCommand = process.env.TEST_CMD;
const reviewers = (process.env.REVIEWERS || 'council-grok').split(',').map((value) => value.trim()).filter(Boolean);
const hardened = boolEnv('HARDENED');
const strictBatch = boolEnv('STRICT_BATCH');
const cleanup = boolEnv('CLEANUP', true);

if (reviewers.length !== 1) fail('REVIEWERS must name exactly one T0 council agent');

const modelByReviewer = {
  'council-grok': process.env.COUNCIL_GROK_MODEL || 'opencode-go/grok-4.5',
  'council-kimi': process.env.COUNCIL_KIMI_MODEL || 'openrouter/moonshotai/kimi-k3',
  'council-qwen': process.env.COUNCIL_QWEN_MODEL || 'openrouter/qwen/qwen3.8-max',
  'council-sol': process.env.COUNCIL_SOL_MODEL || 'openai/gpt-5.6-sol',
  'council-glm': process.env.COUNCIL_GLM_MODEL || 'opencode-go/glm-5.2',
  'council-adversary': process.env.COUNCIL_ADVERSARY_MODEL || 'opencode-go/grok-4.5',
};
for (const reviewer of reviewers) {
  if (!modelByReviewer[reviewer]) fail(`no model pin configured for reviewer ${reviewer}`);
  if (reviewer === 'council-glm') fail('the fixed GLM contributor cannot review its own code');
}

const contributorModel = 'opencode-go/glm-5.2';
if (process.env.CONTRIBUTOR_MODEL && process.env.CONTRIBUTOR_MODEL !== contributorModel) {
  fail(`CONTRIBUTOR_MODEL is fixed to ${contributorModel}`);
}
for (const [reviewer, model] of Object.entries(modelByReviewer)) {
  if (modelFamily(model) === modelFamily(contributorModel)) {
    if (reviewer !== 'council-glm') fail(`${reviewer} resolves to maker model family ${model}`);
  }
}
let testCommands = {};
if (process.env.TEST_CMDS_JSON) {
  try {
    testCommands = JSON.parse(process.env.TEST_CMDS_JSON);
  } catch {
    fail('TEST_CMDS_JSON must be a JSON object mapping item ids to commands');
  }
  if (!testCommands || typeof testCommands !== 'object' || Array.isArray(testCommands)) {
    fail('TEST_CMDS_JSON must be a JSON object mapping item ids to commands');
  }
}

function childEnv({ readOnly }) {
  let injected = {};
  if (process.env.OPENCODE_CONFIG_CONTENT) {
    try {
      injected = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT);
    } catch {
      fail('OPENCODE_CONFIG_CONTENT must be valid JSON');
    }
  }
  injected.agent ??= {};
  injected.agent.build ??= {};
  injected.agent.build.permission = {
    ...(injected.agent.build.permission && typeof injected.agent.build.permission === 'object'
      ? injected.agent.build.permission
      : {}),
    edit: readOnly ? 'deny' : 'allow',
    task: 'deny',
    external_directory: readOnly ? 'deny' : 'allow',
    ...(readOnly ? {
      bash: {
        '*': 'allow',
        'git commit *': 'deny',
        'git merge *': 'deny',
        'git switch *': 'deny',
        'git checkout *': 'deny',
        'git reset *': 'deny',
        'git update-ref *': 'deny',
        'git branch *': 'deny',
        'git tag *': 'deny',
        'git push *': 'deny',
        'git worktree *': 'deny',
        'rm *': 'deny',
        'mv *': 'deny',
        'cp *': 'deny',
      },
    } : {}),
  };
  return { ...process.env, OPENCODE_CONFIG_CONTENT: JSON.stringify(injected) };
}

async function reviewResolvedConflict(item, baseBranch, candidateSha) {
  const beforeRefs = (await git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'])).output;
  const conflictReviews = [];
  for (const reviewer of reviewers) {
    const reviewWorktree = path.join(worktreeRoot, '.reviews', item.name, `${reviewer}-conflict`);
    await mkdir(path.dirname(reviewWorktree), { recursive: true });
    if (await stat(reviewWorktree).catch(() => null)) {
      await git(repo, ['worktree', 'remove', '--force', reviewWorktree], { allowFailure: true });
    }
    await git(repo, ['worktree', 'add', '--detach', reviewWorktree, candidateSha]);
    const before = await reviewSnapshot(reviewWorktree);
    const logFile = path.join(worktreeRoot, `${item.name}.${reviewer}.conflict.log`);
    const prompt = `T0 conflict-resolution review. You are a checker, not an author: do not edit. Inspect candidate integration commit ${candidateSha} for ${item.branch} into ${baseBranch}, compare it to both parents and the declared scope, and run the locked command.\n\nTASK:\n${item.prompt}\n\nDECLARED FILES: ${item.filesTouched.join(', ')}\nTEST_CMD: ${item.testCommand}\n\nReturn exact final lines:\nVERDICT: PASS or VERDICT: FAIL\nFINDINGS: <JSON array>\nFOLLOWUPS: <JSON array>\nAny evidenced P0/P1 fails.\n\n${REVIEW_RUBRIC}\n\nNO SUBAGENTS.`;
    const result = await run(opencode, [
      'run', '--dir', reviewWorktree, '--agent', 'build',
      '--model', modelByReviewer[reviewer], '--format', 'default', prompt,
    ], { cwd: reviewWorktree, logFile, allowFailure: true, env: childEnv({ readOnly: true }) });
    const review = reviewRecord(reviewer, result);
    const after = await reviewSnapshot(reviewWorktree);
    const currentRefs = (await git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'])).output;
    review.integrityValid = JSON.stringify(after) === JSON.stringify(before) && currentRefs === beforeRefs;
    conflictReviews.push(review);
    await git(repo, ['worktree', 'remove', '--force', reviewWorktree], { allowFailure: true });
    if (!review.integrityValid) break;
  }
  const afterRefs = (await git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'])).output;
  const blocking = conflictReviews.some((review) => review.exit !== 0
    || review.verdict !== 'PASS'
    || !review.formatValid
    || !review.integrityValid
    || review.findings.some((finding) => ['P0', 'P1'].includes(String(finding.severity).toUpperCase())));
  return { conflictReviews, blocking: blocking || conflictReviews.length !== reviewers.length || beforeRefs !== afterRefs };
}

await mkdir(worktreeRoot, { recursive: true });
const items = parseManifest(await readFile(manifest, 'utf8'));
for (const item of items) {
  if (item.model !== contributorModel) fail(`item ${item.name} must use fixed contributor model ${contributorModel}`);
  item.testCommand = testCommands[item.name] ?? (items.length === 1 ? defaultTestCommand : null);
  if (typeof item.testCommand !== 'string' || !item.testCommand.trim()) {
    fail(`item ${item.name} has no locked Verification-command; multi-item batches require a complete TEST_CMDS_JSON map`);
  }
}
const currentBranch = (await git(repo, ['branch', '--show-current'])).output.trim();
const mainBranch = process.env.MAIN_BRANCH || currentBranch;
if (!mainBranch) fail('MAIN_BRANCH is required; detached HEAD is not supported');
if (currentBranch !== mainBranch) fail(`repo must be checked out on MAIN_BRANCH (${mainBranch}), found ${currentBranch}`);
const dirty = (await git(repo, ['status', '--porcelain', '--untracked-files=no'])).output.trim();
if (dirty) fail('MAIN_BRANCH worktree must be clean before parallel integration');
const baseSha = (await git(repo, ['rev-parse', mainBranch])).output.trim();

for (const item of items) {
  item.worktree = path.join(worktreeRoot, item.name);
  item.workerLog = path.join(worktreeRoot, `${item.name}.worker.log`);
  const existingWorktree = await stat(item.worktree).catch(() => null);
  if (existingWorktree?.isDirectory()) {
    const checkedOut = (await git(item.worktree, ['branch', '--show-current'], { allowFailure: true })).output.trim();
    if (checkedOut !== item.branch) fail(`${item.worktree} exists on ${checkedOut || 'detached HEAD'}, expected ${item.branch}`);
    continue;
  }
  const branchExists = (await git(repo, ['show-ref', '--verify', '--quiet', `refs/heads/${item.branch}`], { allowFailure: true })).code === 0;
  await git(repo, branchExists
    ? ['worktree', 'add', item.worktree, item.branch]
    : ['worktree', 'add', '-b', item.branch, item.worktree, mainBranch]);
}

await Promise.all(items.map(async (item) => {
  const guard = `\n\nTHE LADDER: work down these rungs in order and stop at the first one that solves it.\n1. Necessity - does this need to exist at all? (YAGNI)\n2. Codebase reuse - is it already implemented in this project?\n3. Standard library - does the stdlib solve it?\n4. Native platform - can built-in features (CSS, HTML5 inputs, DB constraints) handle it?\n5. Existing dependencies - use what is installed before adding anything.\n6. One-liner - can this be a single line?\n7. Minimal implementation - only now, write the smallest thing that works.\n\nNEVER SIMPLIFY AWAY: input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility, or anything the acceptance criteria explicitly asked for. Lazy is not negligent.\n\nTESTS: non-trivial logic requires at least one minimal runnable check (assert, demo(), or a single small test). Trivial code gets none. ${item.testCommand} must pass. Write nothing beyond that.\n\nNO SPECULATIVE ABSTRACTIONS: no interface, factory, or config for a single call site. Fix root causes in shared code, not symptoms in callers. Prefer the compact diff and the fewest files. Mark deliberate trade-offs with a \`ship:\` comment naming the upgrade path.\n\nReport as: [what you built] -> skipped: [X], add when [Y].\n\nNO SUBAGENTS: complete this task yourself. Work only in this worktree. Run ${item.testCommand}, then commit the completed item on ${item.branch}.`;
  const prompt = `${item.prompt}${guard}`;
  const worker = await run(opencode, [
    'run', '--dir', item.worktree, '--agent', 'build',
    '--model', item.model, '--format', 'default', prompt,
  ], { cwd: item.worktree, logFile: item.workerLog, allowFailure: true, env: childEnv({ readOnly: false }) });
  item.workerExit = worker.code;
  if (worker.code !== 0) {
    item.failure = `worker exited ${worker.code}`;
    return;
  }
  const sha = (await git(item.worktree, ['rev-parse', 'HEAD'])).output.trim();
  if (sha === baseSha) {
    item.failure = 'worker produced no commit';
    return;
  }
  item.reviewedSha = sha;
  const test = await shell(item.testCommand, item.worktree, path.join(worktreeRoot, `${item.name}.test.log`));
  item.test = { pass: test.code === 0 ? 1 : 0, fail: test.code === 0 ? 0 : 1, cmd: item.testCommand };
  if (test.code !== 0) item.failure = `Verification-command exited ${test.code}`;
}));

const reviewJobs = [];
const reviewWorktrees = [];
const refsBeforeReview = (await git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'])).output;
for (const item of items.filter((candidate) => !candidate.failure)) {
  item.reviews = [];
  const activeReviewers = hardened ? [...reviewers, 'council-adversary'] : reviewers;
  for (const reviewer of activeReviewers) {
    const reviewWorktree = path.join(worktreeRoot, '.reviews', item.name, reviewer);
    await mkdir(path.dirname(reviewWorktree), { recursive: true });
    if (await stat(reviewWorktree).catch(() => null)) {
      await git(repo, ['worktree', 'remove', '--force', reviewWorktree], { allowFailure: true });
    }
    await git(repo, ['worktree', 'add', '--detach', reviewWorktree, item.reviewedSha]);
    reviewWorktrees.push(reviewWorktree);
    reviewJobs.push((async () => {
      const before = await reviewSnapshot(reviewWorktree);
      const logFile = path.join(worktreeRoot, `${item.name}.${reviewer}.log`);
      const hardenedText = reviewer === 'council-adversary'
        ? 'Hardened teardown: additionally attack blast radius, API drift, security boundaries, and over/under-engineering.'
        : '';
      const prompt = `T0 per-item review. You are a checker, not an author: do not edit. Review only HEAD against base ${baseSha}. Read the task and acceptance criteria below, inspect the real diff and tests, and run the locked command. ${hardenedText}\n\nTASK:\n${item.prompt}\n\nTEST_CMD: ${item.testCommand}\n\nReturn exact final lines:\nVERDICT: PASS or VERDICT: FAIL\nFINDINGS: <JSON array>\nFOLLOWUPS: <JSON array>\nEvery finding must include severity, file:line, trigger, and wrong_behavior. Any evidenced P0/P1 fails.\n\n${REVIEW_RUBRIC}\n\nNO SUBAGENTS.`;
      const result = await run(opencode, [
        'run', '--dir', reviewWorktree, '--agent', 'build',
        '--model', modelByReviewer[reviewer],
        '--format', 'default', prompt,
      ], { cwd: reviewWorktree, logFile, allowFailure: true, env: childEnv({ readOnly: true }) });
      const review = reviewRecord(reviewer, result);
      const after = await reviewSnapshot(reviewWorktree);
      review.integrityValid = JSON.stringify(after) === JSON.stringify(before);
      item.reviews.push(review);
    })());
  }
}
await Promise.all(reviewJobs);
for (const reviewWorktree of reviewWorktrees) {
  await git(repo, ['worktree', 'remove', '--force', reviewWorktree], { allowFailure: true });
}
const refsAfterReview = (await git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'])).output;
const reviewerMutatedRefs = refsBeforeReview !== refsAfterReview;

for (const item of items) {
  const hasBlockingFinding = item.reviews?.some((review) => review.findings.some((finding) => ['P0', 'P1'].includes(String(finding.severity).toUpperCase())));
  const invalidReview = item.reviews?.some((review) => review.exit !== 0 || review.verdict !== 'PASS' || !review.formatValid || !review.integrityValid);
  if (!item.failure && (invalidReview || hasBlockingFinding || reviewerMutatedRefs)) {
    item.failure = 'missing or failing T0 verdict';
  }
  item.filesTouched = item.failure && item.workerExit !== 0
    ? []
    : (await git(repo, ['diff', '--name-only', `${baseSha}...${item.reviewedSha}`], { allowFailure: true })).output.split('\n').filter(Boolean);
  item.findings = item.reviews?.flatMap((review) => review.findings) ?? [];
  item.followups = item.reviews?.flatMap((review) => review.followups) ?? [];
  item.test ??= { pass: 0, fail: 1, cmd: item.testCommand };
}

const approved = items.filter((item) => !item.failure);
if (strictBatch && approved.length !== items.length) {
  for (const item of approved) item.failure = 'STRICT_BATCH aborted merge because a peer failed';
}

const results = { main_branch: mainBranch, merged: [], blocked: [], failed: [], conflicts: [] };
let strictIntegrationBranch = null;
if (strictBatch && items.every((item) => !item.failure)) {
  strictIntegrationBranch = `ship/strict-integration-${process.pid}-${Date.now()}`;
  await git(repo, ['switch', '-c', strictIntegrationBranch]);
}
let expectedIntegrationHead = (await git(repo, ['rev-parse', 'HEAD'])).output.trim();
for (const item of items.filter((candidate) => !candidate.failure)) {
  const integrationHead = (await git(repo, ['rev-parse', 'HEAD'])).output.trim();
  if (integrationHead !== expectedIntegrationHead) {
    item.failure = 'integration branch changed after review';
    if (strictBatch) break;
    continue;
  }
  const merge = await git(repo, ['merge', '--no-commit', '--no-ff', item.reviewedSha], { allowFailure: true });
  let conflicts = [];
  if (merge.code !== 0) {
    conflicts = (await git(repo, ['diff', '--name-only', '--diff-filter=U'])).output.split('\n').filter(Boolean);
    results.conflicts.push({ name: item.name, files: conflicts });
    const resolverPrompt = `Resolve the active merge for ${item.branch} into ${strictIntegrationBranch || mainBranch}. Conflicted files: ${conflicts.join(', ')}. Declared incoming scope: ${item.filesTouched.join(', ')}. Keep both unique non-overlapping hunks. For the same hunk, prefer the incoming branch only in its declared scope; otherwise prefer HEAD. Remove every marker, do not broaden scope, run ${item.testCommand}, and do not commit. NO SUBAGENTS.`;
    const resolver = await run(opencode, [
      'run', '--dir', repo, '--agent', 'build',
      '--model', 'opencode-go/glm-5.2', '--format', 'default', resolverPrompt,
    ], { cwd: repo, logFile: path.join(worktreeRoot, `${item.name}.resolver.log`), allowFailure: true, env: childEnv({ readOnly: false }) });
    const unresolved = (await git(repo, ['diff', '--name-only', '--diff-filter=U'])).output.trim();
    if (resolver.code !== 0 || unresolved) {
      await git(repo, ['merge', '--abort'], { allowFailure: true });
      item.failure = 'merge conflict was not resolved';
      if (strictBatch) break;
      continue;
    }
  }
  if ((await git(repo, ['rev-parse', 'HEAD'])).output.trim() !== expectedIntegrationHead) {
    await git(repo, ['merge', '--abort'], { allowFailure: true });
    item.failure = 'integration branch changed during merge';
    if (strictBatch) break;
    continue;
  }

  const integratedTest = await shell(item.testCommand, repo, path.join(worktreeRoot, `${item.name}.integrated-test.log`));
  if (integratedTest.code !== 0) {
    await git(repo, ['merge', '--abort'], { allowFailure: true });
    item.failure = `integrated Verification-command exited ${integratedTest.code}`;
    if (strictBatch) break;
    continue;
  }
  if (conflicts.length) {
    const candidateTree = (await git(repo, ['write-tree'])).output.trim();
    const candidate = (await git(repo, [
      'commit-tree', candidateTree,
      '-p', expectedIntegrationHead,
      '-p', item.reviewedSha,
      '-m', `Candidate merge ${item.branch}`,
    ])).output.trim();
    const integrationBeforeReview = await reviewSnapshot(repo);
    const { conflictReviews, blocking } = await reviewResolvedConflict(item, strictIntegrationBranch || mainBranch, candidate);
    const integrationAfterReview = await reviewSnapshot(repo);
    item.reviews.push(...conflictReviews);
    item.findings.push(...conflictReviews.flatMap((review) => review.findings));
    item.followups.push(...conflictReviews.flatMap((review) => review.followups));
    if (blocking || JSON.stringify(integrationAfterReview) !== JSON.stringify(integrationBeforeReview)) {
      await git(repo, ['merge', '--abort'], { allowFailure: true });
      item.failure = 'conflict resolution failed independent T0 review';
      if (strictBatch) break;
      continue;
    }
  }
  await git(repo, ['commit', '-m', `Merge ${item.branch}`]);
  const sha = (await git(repo, ['rev-parse', 'HEAD'])).output.trim();
  expectedIntegrationHead = sha;
  results.merged.push({ name: item.name, branch: item.branch, sha, verdict: 'PASS' });
  item.merged = true;
}

if (strictIntegrationBranch) {
  const strictFailed = items.some((item) => item.failure) || results.merged.length !== items.length;
  await git(repo, ['switch', mainBranch]);
  if (strictFailed) {
    await git(repo, ['branch', '-D', strictIntegrationBranch]);
    results.merged = [];
    for (const item of items) {
      item.merged = false;
      item.failure ||= 'STRICT_BATCH rolled back because a peer failed during integration';
    }
  } else {
    await git(repo, ['merge', '--ff-only', strictIntegrationBranch]);
    await git(repo, ['branch', '-d', strictIntegrationBranch]);
  }
}

for (const item of items) {
  const verdict = item.merged ? 'PASS' : 'FAIL';
  if (!item.merged) results.failed.push({ name: item.name, branch: item.branch, reason: item.failure || 'not merged' });
  await atomicJson(path.join(worktreeRoot, `${item.name}.digest.json`), {
    id: item.name,
    verdict,
    files_touched: item.filesTouched,
    tests: item.test,
    findings: item.findings,
    followups: item.followups,
  });
}
await atomicJson(path.join(worktreeRoot, 'results.json'), results);

if (cleanup) {
  for (const item of items.filter((candidate) => candidate.merged)) {
    await git(repo, ['worktree', 'remove', item.worktree], { allowFailure: true });
  }
  await git(repo, ['worktree', 'prune'], { allowFailure: true });
}

process.stdout.write(`${JSON.stringify(results)}\n`);
if (results.failed.length && strictBatch) process.exitCode = 1;
