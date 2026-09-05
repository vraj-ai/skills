import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runInit } from '../src/commands/init.js';
import { installOne } from '../src/install.js';
import { readManifest } from '../src/manifest.js';
import { makeTmpDir, writeSkill, cleanup } from './helpers.js';

const skipLinkCreationFailureTest = process.platform === 'win32' || process.getuid?.() === 0;

async function setup() {
  const repo = await makeTmpDir('vskills-repo-');
  const installRoot = await makeTmpDir('vskills-install-');
  const target = await makeTmpDir('vskills-target-');
  await writeSkill(repo, 'alpha', { name: 'alpha', description: 'Alpha.' });
  return { repo, installRoot, target };
}

test('fresh init installs every discovered skill', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, 'installed');

    await assert.doesNotReject(fs.access(path.join(installRoot, 'alpha', 'SKILL.md')));

    const linkPath = path.join(target, 'alpha');
    const stat = await fs.lstat(linkPath);
    assert.ok(stat.isSymbolicLink());
    assert.equal(await fs.realpath(linkPath), await fs.realpath(path.join(installRoot, 'alpha')));

    const manifest = await readManifest(installRoot);
    assert.ok(manifest.skills.alpha.contentHash);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a link-creation failure warns without aborting later skills', { skip: skipLinkCreationFailureTest }, async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await writeSkill(repo, 'beta', { name: 'beta', description: 'Beta.' });
    await fs.chmod(target, 0o500);

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });

    assert.deepEqual(
      result.results
        .map(({ name, status }) => ({ name, status }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      [
        { name: 'alpha', status: 'installed' },
        { name: 'beta', status: 'installed' },
      ]
    );
    assert.ok(
      result.messages.some(
        (message) =>
          message.includes(path.join(target, 'alpha')) &&
          message.includes('EACCES') &&
          message.includes('installed in the install root') &&
          message.includes('was not linked into this target')
      )
    );
    assert.equal(result.ok, false);
    assert.equal(result.linkFailures.length, 2);
    await assert.doesNotReject(fs.access(path.join(installRoot, 'alpha', 'SKILL.md')));
    await assert.doesNotReject(fs.access(path.join(installRoot, 'beta', 'SKILL.md')));
    await assert.rejects(fs.lstat(path.join(target, 'alpha')), { code: 'ENOENT' });
    await assert.rejects(fs.lstat(path.join(target, 'beta')), { code: 'ENOENT' });

    await fs.chmod(target, 0o700);
    const rerun = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.equal(rerun.ok, true);
    for (const name of ['alpha', 'beta']) {
      const linkPath = path.join(target, name);
      const stat = await fs.lstat(linkPath);
      assert.ok(stat.isSymbolicLink());
      assert.equal(await fs.realpath(linkPath), await fs.realpath(path.join(installRoot, name)));
    }
  } finally {
    await fs.chmod(target, 0o700).catch(() => {});
    await cleanup(repo, installRoot, target);
  }
});

test('the manifest is written when a link-creation failure occurs', { skip: skipLinkCreationFailureTest }, async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await fs.chmod(target, 0o500);

    await runInit({ repoRoot: repo, installRoot, targets: [target] });

    const manifest = await readManifest(installRoot);
    assert.ok(manifest.skills.alpha?.contentHash);
  } finally {
    await fs.chmod(target, 0o700).catch(() => {});
    await cleanup(repo, installRoot, target);
  }
});

test('re-running init is a no-op', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    const manifestBefore = await readManifest(installRoot);

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'up-to-date');

    const manifestAfter = await readManifest(installRoot);
    assert.deepEqual(manifestBefore, manifestAfter);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a pre-existing real file at the agent-target path is left untouched', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await fs.writeFile(path.join(target, 'alpha'), 'not a symlink', 'utf8');

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'installed');
    assert.equal(result.ok, true);
    assert.deepEqual(result.linkFailures, []);
    assert.ok(result.messages.some((m) => m.includes('left untouched')));

    const content = await fs.readFile(path.join(target, 'alpha'), 'utf8');
    assert.equal(content, 'not a symlink');
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a malformed skill is skipped at discovery, not partially installed', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    const dir = path.join(repo, 'broken');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'SKILL.md'), '---\ndescription: no name\n---\nbody\n', 'utf8');

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results.length, 1); // only alpha — broken was skipped at discovery
    await assert.rejects(fs.access(path.join(installRoot, 'broken')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('an interrupted copy never leaves the install-root folder replaced or partial', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    const before = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');

    const badFile = path.join(repo, 'alpha', 'unreadable.md');
    await fs.writeFile(badFile, 'x', 'utf8');
    await fs.chmod(badFile, 0o000);

    const manifest = await readManifest(installRoot);
    const skill = { name: 'alpha', dir: path.join(repo, 'alpha'), dependencies: [] };

    try {
      await assert.rejects(installOne({ skill, installRoot, targets: [target], manifest, force: true }));
      const after = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
      assert.equal(after, before);
    } finally {
      await fs.chmod(badFile, 0o644).catch(() => {});
    }
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a pre-existing byte-identical unmanaged copy is adopted, not flagged', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    // Simulate another installer having copied the skill in verbatim.
    await fs.cp(path.join(repo, 'alpha'), path.join(installRoot, 'alpha'), { recursive: true });

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'adopted');

    const manifest = await readManifest(installRoot);
    assert.ok(manifest.skills.alpha.contentHash);
    const stat = await fs.lstat(path.join(target, 'alpha'));
    assert.ok(stat.isSymbolicLink());
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a strictly older installed version is auto-updated, even if unmanaged', async () => {
  const repo = await makeTmpDir('vskills-repo-');
  const installRoot = await makeTmpDir('vskills-install-');
  const target = await makeTmpDir('vskills-target-');
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', version: '2.0.0', body: 'New body.' });
    // Unmanaged older copy already on disk — no manifest entry for it.
    await writeSkill(installRoot, 'alpha', { name: 'alpha', version: '1.0.0', body: 'Old body.' });

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.equal(result.results[0].status, 'updated');
    assert.ok(result.messages.some((m) => m.includes('v1.0.0 → v2.0.0')));

    const content = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('New body.'));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('init that keeps a drifted skill still repairs missing links', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await fs.appendFile(path.join(installRoot, 'alpha', 'SKILL.md'), '\nlocal edit\n', 'utf8');
    const before = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    await fs.rm(path.join(target, 'alpha'));

    const result = await runInit({
      repoRoot: repo,
      installRoot,
      targets: [target],
      resolveConflicts: async () => [],
    });

    assert.equal(result.results[0].status, 'skipped');
    const after = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.equal(after, before);
    const linkPath = path.join(target, 'alpha');
    const stat = await fs.lstat(linkPath);
    assert.ok(stat.isSymbolicLink());
    assert.equal(await fs.realpath(linkPath), await fs.realpath(path.join(installRoot, 'alpha')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a conflicting copy the resolver declines is kept, not overwritten', async () => {
  const repo = await makeTmpDir('vskills-repo-');
  const installRoot = await makeTmpDir('vskills-install-');
  const target = await makeTmpDir('vskills-target-');
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', version: '1.0.0', body: 'Repo body.' });
    await writeSkill(installRoot, 'alpha', { name: 'alpha', version: '1.0.0', body: 'Their body.' });

    const seen = [];
    const result = await runInit({
      repoRoot: repo,
      installRoot,
      targets: [target],
      resolveConflicts: async (conflicts) => {
        seen.push(...conflicts);
        return []; // keep everything
      },
    });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].name, 'alpha');
    assert.equal(result.results[0].status, 'skipped');
    assert.ok(result.messages.some((m) => m.includes('kept yours')));

    const content = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('Their body.'));
    const manifest = await readManifest(installRoot);
    assert.equal(manifest.skills.alpha, undefined);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('an overwritten conflict backs up the previous copy first', async () => {
  const repo = await makeTmpDir('vskills-repo-');
  const installRoot = await makeTmpDir('vskills-install-');
  const target = await makeTmpDir('vskills-target-');
  try {
    await writeSkill(repo, 'alpha', { name: 'alpha', version: '1.0.0', body: 'Repo body.' });
    await writeSkill(installRoot, 'alpha', { name: 'alpha', version: '1.0.0', body: 'Their body.' });

    const result = await runInit({
      repoRoot: repo,
      installRoot,
      targets: [target],
      resolveConflicts: async (conflicts) => conflicts.map((c) => c.name),
    });

    assert.equal(result.results[0].status, 'updated');

    const content = await fs.readFile(path.join(installRoot, 'alpha', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('Repo body.'));

    const backupRoot = path.join(installRoot, '.vskills-backup');
    const backups = await fs.readdir(backupRoot);
    assert.equal(backups.length, 1);
    const backed = await fs.readFile(
      path.join(backupRoot, backups[0], 'SKILL.md'),
      'utf8'
    );
    assert.ok(backed.includes('Their body.'));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('init retires managed skills that vanished from the repo', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await writeSkill(repo, 'gone', { name: 'gone', description: 'Gone.' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await fs.rm(path.join(repo, 'gone'), { recursive: true, force: true });

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.ok(result.results.some((r) => r.name === 'gone' && r.status === 'retired'));
    await assert.rejects(fs.access(path.join(installRoot, 'gone')));
    const manifest = await readManifest(installRoot);
    assert.equal(manifest.skills.gone, undefined);
    await assert.rejects(fs.access(path.join(target, 'gone')));
    const backups = await fs.readdir(path.join(installRoot, '.vskills-backup'));
    assert.ok(backups.some((name) => name.startsWith('gone-')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a selection installs only the named skills, leaving the rest untouched', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await writeSkill(repo, 'beta', { name: 'beta', description: 'Beta.' });

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target], selection: ['alpha'] });

    assert.deepEqual(result.results.map((r) => r.name), ['alpha']);
    await assert.doesNotReject(fs.access(path.join(installRoot, 'alpha', 'SKILL.md')));
    await assert.rejects(fs.access(path.join(installRoot, 'beta')));
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('a skill that drops out of the selection is retired, not left orphaned', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await writeSkill(repo, 'beta', { name: 'beta', description: 'Beta.' });
    await runInit({ repoRoot: repo, installRoot, targets: [target], selection: ['alpha', 'beta'] });
    await assert.doesNotReject(fs.access(path.join(installRoot, 'beta', 'SKILL.md')));

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target], selection: ['alpha'] });

    assert.ok(result.results.some((r) => r.name === 'beta' && r.status === 'retired'));
    await assert.rejects(fs.access(path.join(installRoot, 'beta')));
    const manifest = await readManifest(installRoot);
    assert.equal(manifest.skills.beta, undefined);
    assert.ok(manifest.skills.alpha);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

test('init leaves a drifted vanished skill installed', async () => {
  const { repo, installRoot, target } = await setup();
  try {
    await writeSkill(repo, 'gone', { name: 'gone', description: 'Gone.' });
    await runInit({ repoRoot: repo, installRoot, targets: [target] });
    await fs.appendFile(path.join(installRoot, 'gone', 'SKILL.md'), '\nlocal edit\n');
    await fs.rm(path.join(repo, 'gone'), { recursive: true, force: true });

    const result = await runInit({ repoRoot: repo, installRoot, targets: [target] });
    assert.ok(result.results.some((r) => r.name === 'gone' && r.status === 'retired-skipped-drift'));
    await fs.access(path.join(installRoot, 'gone'));
    const manifest = await readManifest(installRoot);
    assert.ok(manifest.skills.gone);
  } finally {
    await cleanup(repo, installRoot, target);
  }
});

