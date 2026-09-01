import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

function render(mdCfg){
  const enabled = (name) => new RegExp(`^\\s*${name}:\\s*\\n\\s+enabled:\\s*true`, 'm').test(mdCfg);
  let out='';
  if(enabled('prSummary')) out+='PR Summary';
  if(enabled('confidenceScore')) out+='Confidence Score';
  if(enabled('issueTable')) out+='Issue Table';
  if(enabled('sequenceDiagram')) out+='Sequence Diagram';
  if(enabled('commentsOutsideDiff')) out+='Comments Outside Diff';
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
  const off = render(cfg.replace(/(confidenceScore:\s*\n\s+enabled:) true/, '$1 false'));
  assert.ok(!off.includes('Confidence Score'), 'toggle off hides section');
});

test('pr-review.yml posts real annotations and never publishes model reasoning', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-review.yml'), 'utf8');
  assert.match(yml, /<!-- vskills-pr-review -->/);
  assert.match(yml, /check-runs/);
  assert.match(yml, /output:\{title:/);
  assert.match(yml, /annotations/);
  assert.match(yml, /annotation_level/);
  assert.match(yml, /response_format: \{type: "json_object"\}/);
  assert.doesNotMatch(yml, /message\.reasoning/);
  assert.match(yml, /gh pr comment/);
});

test('review gate honors config and does not execute PR-controlled package scripts', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-review.yml'), 'utf8');
  assert.match(yml, /required_confidence/);
  assert.match(yml, /use_status_checks/);
  assert.match(yml, /auto_approve/);
  assert.match(yml, /reviewThreads/);
  assert.doesNotMatch(yml, /npm run lint/);
  assert.doesNotMatch(yml, /npx --yes/);
});
