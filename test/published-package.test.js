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

async function localSkillFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await localSkillFiles(absolute));
    else if (entry.isFile() && entry.name === 'SKILL.md') files.push(absolute);
  }
  return files;
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

test('relative SKILL.md references resolve to skills in the published tree', async () => {
  const tracked = await trackedFiles();
  const skillMd = new Set([...tracked].filter((file) => file.endsWith('/SKILL.md')));

  // Include an untracked standalone skill while the change is under review;
  // once committed it is already covered by the tracked-file set.
  for (const absolute of await localSkillFiles(path.join(repo, 'standalone'))) {
    skillMd.add(path.relative(repo, absolute));
  }

  const broken = [];
  const reference = /(?:^|[\s(`])((?:\.\.?\/)*(?:[A-Za-z0-9._-]+\/)*SKILL\.md(?:#[A-Za-z0-9._-]+)?)/gm;
  for (const rel of skillMd) {
    const body = await fs.readFile(path.join(repo, rel), 'utf8');
    for (const [, ref] of body.matchAll(reference)) {
      const target = path.resolve(path.dirname(path.join(repo, rel)), ref.split('#')[0]);
      const insideRepo = target === repo || target.startsWith(`${repo}${path.sep}`);
      let isFile = false;
      if (insideRepo) {
        try {
          isFile = (await fs.stat(target)).isFile();
        } catch {
          isFile = false;
        }
      }
      if (!insideRepo || !isFile) broken.push(`${rel} -> ${ref}`);
    }
  }

  assert.deepEqual(broken, [], 'a shipped skill references a missing relative SKILL.md');
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
  const skillMd = [...tracked].filter((f) => f.endsWith('/SKILL.md'));
  const skills = new Set(skillMd.map((f) => f.split('/').at(-2)));

  assert.ok(skills.has('ship') && skills.has('push-handoff'), 'skill discovery failed');
  assert.ok(
    skills.has('github-projects-pipeline') && skills.has('legacy-coder'),
    'nested skills under pipeline/ and legacy-workflow/ are invisible to this gate',
  );

  // Known references to things outside this package. Each is deliberate:
  // `/goal` is the goals skill's own invocation alias; `/loop` and `/schedule`
  // are Claude Code built-ins; `/code-review` and `/wayfinder` live in other
  // agent skill sets, as does `/create-verification-skill` (pstack, invoked by
  // setup-vskills Step 1.4). The point of the allowlist is the ratchet: a NEW
  // unshipped reference fails this gate, which is how `/handoff` reached the
  // published package unnoticed (#31).
  const external = new Set([
    'goal',
    'loop',
    'schedule',
    'code-review',
    'wayfinder',
    'create-verification-skill',
    'plugin',
    'reload-plugins',
  ]);

  const offenders = [];
  for (const md of skillMd) {
    const dir = md.slice(0, -'SKILL.md'.length);
    for (const name of ['SKILL.md', 'REFERENCE.md']) {
      const rel = `${dir}${name}`;
      if (!tracked.has(rel)) continue;
      const body = await fs.readFile(path.join(repo, rel), 'utf8');
      for (const [, invoked] of body.matchAll(/(?:^|[\s(`])\/([a-z][a-z0-9-]*)\b/gm)) {
        if (!skills.has(invoked) && !external.has(invoked)) {
          offenders.push(`${rel} invokes /${invoked}`);
        }
      }
    }
  }

  assert.deepEqual([...new Set(offenders)], [], 'a shipped skill invokes one that is not in the package');
});
