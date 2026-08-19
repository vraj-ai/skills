import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function trackedFiles() {
  const { stdout } = await execFileAsync('git', ['-C', repo, 'ls-files'], { maxBuffer: 1024 * 1024 * 8 });
  return new Set(stdout.split('\n').filter(Boolean));
}

// #31: this repo publishes to npm, and npmjs.com resolves the README's relative
// links against the `repository` field. A link to an untracked path — `docs/` is
// gitignored, and `docs/invariants.md` never existed at all — becomes a 404 on
// the package landing page, on the very sentence offering it as evidence.
test('every relative README link points at something that actually ships', async () => {
  const readme = await fs.readFile(path.join(repo, 'README.md'), 'utf8');
  const tracked = await trackedFiles();

  const targets = [...readme.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((m) => m[1].split('#')[0].trim())
    .filter((t) => t && !/^(https?:|mailto:)/.test(t));

  const broken = targets.filter((t) => {
    const rel = t.replace(/\/$/, '');
    return !tracked.has(rel) && ![...tracked].some((f) => f.startsWith(`${rel}/`));
  });

  assert.deepEqual(broken, [], 'README links to paths that are not in the published package');
});

test('the declared license ships as a LICENSE file', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(repo, 'package.json'), 'utf8'));
  const license = await fs.readFile(path.join(repo, 'LICENSE'), 'utf8');

  assert.equal(pkg.license, 'MIT');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) \d{4}/);
});

test('no stale handoff artifacts ship in the tarball', async () => {
  const tracked = await trackedFiles();
  const stale = [...tracked].filter((f) => path.basename(f).startsWith('.handoff-'));

  // These advertised `npx github:VrajGupta/skills add <skill>` — a stale owner
  // and the exact install path the npm move retracted.
  assert.deepEqual(stale, [], 'stale .handoff-* files are tracked and would ship');
});

test('shipped skills never invoke a skill this repo does not ship', async () => {
  const tracked = await trackedFiles();
  const skills = new Set([...tracked]
    .filter((f) => f.endsWith('/SKILL.md') && !f.includes('/', f.indexOf('/') + 1))
    .map((f) => f.split('/')[0]));

  assert.ok(skills.has('ship') && skills.has('push-handoff'), 'skill discovery failed');

  // Known references to things outside this package. Each is deliberate:
  // `/goal` is the goals skill's own invocation alias, `/loop` is a Claude Code
  // built-in, and the `/legacy-*` trio is the external pipeline that calls
  // multi-agent-review rather than anything it calls itself. The point of the
  // allowlist is the ratchet: a NEW unshipped reference fails this gate, which
  // is how `/handoff` reached the published package unnoticed (#31).
  const external = new Set(['goal', 'loop', 'legacy-coder', 'legacy-debugger', 'legacy-planner']);

  const offenders = [];
  for (const skill of skills) {
    const body = await fs.readFile(path.join(repo, skill, 'SKILL.md'), 'utf8');
    for (const [, invoked] of body.matchAll(/(?:^|[\s(`])\/([a-z][a-z0-9-]*)\b/gm)) {
      if (!skills.has(invoked) && !external.has(invoked)) {
        offenders.push(`${skill}/SKILL.md invokes /${invoked}`);
      }
    }
  }

  assert.deepEqual([...new Set(offenders)], [], 'a shipped skill invokes one that is not in the package');
});
