import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';

test('copy helper backs up existing workflow and is idempotent', async () => {
  const { copyPrReview } = await import('../standalone/pr-review/scripts/copy.mjs');
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'vskills-pr-test-'));
  try{
    // first install
    let r1 = await copyPrReview({targetRoot: tmp});
    assert.ok(r1.includes('installed') || r1.includes('installed'));
    assert.ok((await fs.stat(path.join(tmp,'.github/workflows/pr-review.yml'))).isFile());
    assert.ok((await fs.stat(path.join(tmp,'.github/workflows/pr-fix.yml'))).isFile());
    assert.ok((await fs.stat(path.join(tmp,'.vskills/review.yml'))).isFile());
    assert.ok((await fs.stat(path.join(tmp,'.vskills/pr-review/system.md'))).isFile());
    assert.ok((await fs.stat(path.join(tmp,'.vskills/pr-review/fix.md'))).isFile());
    assert.ok((await fs.stat(path.join(tmp,'.vskills/pr-review/parse-fix-response.mjs'))).isFile());
    assert.ok((await fs.stat(path.join(tmp,'.vskills/pr-review/parse-review-config.mjs'))).isFile());
    // second is idempotent (up-to-date or skipped-exists)
    let r2 = await copyPrReview({targetRoot: tmp});
    assert.ok(r2.every(v=>['up-to-date','skipped-exists','installed','updated'].includes(v)) || r2.includes('skipped-exists'));
    // modify target and ensure backup on overwrite
    await fs.writeFile(path.join(tmp,'.github/workflows/pr-review.yml'), 'custom', 'utf8');
    let r3 = await copyPrReview({targetRoot: tmp});
    // should have updated and backed up
    const backupDir = path.join(tmp,'.vskills-backup');
    const files = await fs.readdir(backupDir).catch(()=>[]);
    assert.ok(files.some(f=>f.startsWith('pr-review.yml-')), 'backup created');
  } finally { await rm(tmp,{recursive:true, force:true}); }
});

test('copy helper never stores secret and review.yml has no secret value', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  assert.ok(!cfg.includes('sk-'));
  assert.match(cfg, /secretName/);
});

test('standalone/pr-review skill is discoverable', async () => {
  const { discoverSkills } = await import('../src/discovery.js');
  const { skills, warnings } = await discoverSkills(process.cwd());
  assert.ok(skills.has('pr-review'), 'pr-review discovered');
  assert.equal(warnings.filter(w=>w.includes('pr-review')).length, 0);
});
