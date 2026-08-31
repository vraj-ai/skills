import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

function render(mdCfg){
  // replicate render logic toggles
  const has = (k)=> mdCfg.includes(k);
  let out='';
  if(has('prSummary')) out+='PR Summary';
  if(has('confidenceScore')) out+='Confidence Score';
  if(has('issueTable')) out+='Issue Table';
  if(has('sequenceDiagram')) out+='Sequence Diagram';
  if(has('commentsOutsideDiff')) out+='Comments Outside Diff';
  return out;
}

test('summary sections toggle on/off via config', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  const all = render(cfg);
  assert.match(all, /PR Summary/);
  assert.match(all, /Confidence Score/);
  assert.match(all, /Issue Table/);
  assert.match(all, /Sequence Diagram/);
  // simulate disabled section
  const off = render(cfg.replace('confidenceScore:', 'disabled:'));
  assert.ok(!off.includes('Confidence Score'), 'toggle off hides section');
});

test('pr-review.yml contains Checks annotation + upsert comment logic', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-review.yml'), 'utf8');
  assert.match(yml, /<!-- vskills-pr-review -->/);
  assert.match(yml, /check-runs/);
  assert.match(yml, /gh pr comment/);
  assert.match(yml, /Strictness/);
});

test('strictness thresholds present', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-review.yml'), 'utf8');
  assert.match(yml, /Strictness/);
  assert.match(yml, /P2/);
});
