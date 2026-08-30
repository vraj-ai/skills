import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('review.yml schema validates enums and bounds', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  // enums
  assert.match(cfg, /strictness:\s*(Low|Medium|High)/);
  assert.match(cfg, /maximumRisk:\s*(Low|Medium|High|Critical)/);
  // bounds
  const req = cfg.match(/requiredConfidence:\s*(\d)/);
  assert.ok(req, 'requiredConfidence present');
  const n = parseInt(req[1],10);
  assert.ok(n>=0 && n<=5, '0-5');
  // collapsible flags
  assert.match(cfg, /prSummary:/);
  assert.match(cfg, /confidenceScore:/);
  assert.match(cfg, /issueTable:/);
  assert.match(cfg, /sequenceDiagram:/);
  assert.match(cfg, /commentsOutsideDiff:/);
  assert.match(cfg, /collapsible:/);
  assert.match(cfg, /defaultOpen:/);
  // when
  assert.match(cfg, /autoReviewOnNewCommits:/);
  assert.match(cfg, /reviewDraftPrs:/);
  assert.match(cfg, /fileChangeLimit:\s*100/);
});

test('model wiring is BYOK and never hardcodes secret value', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  assert.match(cfg, /secretName:\s*"OPENAI_API_KEY"/);
  assert.ok(!cfg.includes('sk-'), 'no secret value');
  assert.match(cfg, /provider:\s*none/);
  assert.match(cfg, /auth:\s*none/);
});
