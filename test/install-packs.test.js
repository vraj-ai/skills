import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cleanup, makeTmpDir, skillPath, writeSkill } from './helpers.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { installPacks } = await import(
  pathToFileURL(skillPath(repo, 'setup-vskills', 'scripts', 'install-packs.mjs')).href
);

test('packs link by priority, never shadow vskills, and only replace under --force', async () => {
  const tmp = await makeTmpDir('vskills-packs-');
  try {
    const installRoot = path.join(tmp, 'agents');
    const target = path.join(tmp, 'claude');
    await fs.mkdir(installRoot, { recursive: true });
    await fs.writeFile(
      path.join(installRoot, '.vskills-manifest.json'),
      JSON.stringify({ skills: { ship: {} } }),
    );
    await writeSkill(tmp, 'pst/skills/teach', { name: 'teach', body: 'pstack teach' });
    await writeSkill(tmp, 'pst/skills/ship', { name: 'ship', body: 'pstack ship' });
    await writeSkill(tmp, 'matt/skills/productivity/teach', { name: 'teach', body: 'matt teach' });
    await writeSkill(tmp, 'matt/skills/engineering/wayfinder', { name: 'wayfinder' });
    await writeSkill(tmp, 'matt/skills/deprecated/old', { name: 'old' });
    await writeSkill(tmp, 'stale/grill-me', { name: 'grill-me', body: 'hand-installed copy' });
    await fs.cp(path.join(tmp, 'stale/grill-me'), path.join(installRoot, 'grill-me'), { recursive: true });
    await writeSkill(tmp, 'matt/skills/productivity/grill-me', { name: 'grill-me', body: 'upstream' });

    const packs = [
      { id: 'pstack', dir: path.join(tmp, 'pst'), skills: 'skills' },
      { id: 'mattpocock', dir: path.join(tmp, 'matt'), skills: 'skills', skip: ['deprecated'] },
    ];
    const run = (force = false) => installPacks({ installRoot, targets: [target], packs, force });

    const first = await run();
    assert.equal(first.owner.get('teach'), 'pstack');
    assert.equal(first.owner.get('ship'), 'vskills');
    assert.equal(first.owner.has('old'), false);
    assert.match(await fs.readFile(path.join(target, 'teach', 'SKILL.md'), 'utf8'), /pstack teach/);
    assert.ok(first.log.some((line) => /mattpocock\/teach: skipped, pstack owns/.test(line)));
    assert.ok(first.log.some((line) => /grill-me: something else is there/.test(line)));
    assert.match(await fs.readFile(path.join(installRoot, 'grill-me', 'SKILL.md'), 'utf8'), /hand-installed/);

    const again = await run();
    assert.equal(again.counts.linked, 0, 'a re-run links nothing new');
    assert.ok(again.counts['up-to-date'] >= 4, 'a re-run recognises its own links');
    assert.equal(await fs.lstat(path.join(target, 'grill-me')).catch(() => null), null,
      'a blocked install root slot is not linked into agent targets');

    const forced = await run(true);
    assert.equal(forced.counts.replaced, 1);
    assert.match(await fs.readFile(path.join(target, 'grill-me', 'SKILL.md'), 'utf8'), /upstream/);
    const backups = await fs.readdir(path.join(installRoot, '.vskills-backup'));
    assert.equal(backups.length, 1);
    assert.match(backups[0], /^grill-me-/);
    assert.match(await fs.readFile(path.join(installRoot, '.vskills-backup', backups[0], 'SKILL.md'), 'utf8'),
      /hand-installed/, 'the backup keeps the replaced content');
  } finally {
    await cleanup(tmp);
  }
});

test('install-packs runs when invoked through a linked install root', async () => {
  const tmp = await makeTmpDir('vskills-packs-link-');
  try {
    const scripts = path.dirname(skillPath(repo, 'setup-vskills', 'scripts', 'install-packs.mjs'));
    const linked = path.join(tmp, 'scripts');
    await fs.symlink(scripts, linked, process.platform === 'win32' ? 'junction' : 'dir');
    const home = path.join(tmp, 'home');
    await fs.mkdir(path.join(home, '.agents', 'skills'), { recursive: true });
    const empty = path.join(tmp, 'empty');
    await fs.mkdir(empty);
    const out = execFileSync(process.execPath, [path.join(linked, 'install-packs.mjs')], {
      encoding: 'utf8',
      env: {
        ...process.env, HOME: home, USERPROFILE: home,
        VSKILLS_PACK_PSTACK: empty, VSKILLS_PACK_ADDYOSMANI: empty, VSKILLS_PACK_MATTPOCOCK: empty,
      },
    });
    assert.match(out, /install-packs: 0 linked/);
  } finally {
    await cleanup(tmp);
  }
});
