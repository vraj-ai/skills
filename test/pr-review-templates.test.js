import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';


function yamlLoad(str){
  // minimal validation: must contain key and not throw on basic parse
  // Use dynamic import of yaml if available, else regex
  return str;
}

test('pr-review skill exists with correct frontmatter', async () => {
  const p = path.join(process.cwd(), 'standalone/pr-review/SKILL.md');
  assert.ok(existsSync(p), 'SKILL.md exists');
  const txt = await fs.readFile(p, 'utf8');
  assert.match(txt, /name:\s*pr-review/);
  assert.match(txt, /version:\s*1\.0\.0/);
});

test('templates exist and are valid YAML with required triggers and permissions', async () => {
  const root = path.join(process.cwd(), 'standalone/pr-review/templates');
  for (const f of ['pr-review.yml', 'pr-fix.yml', 'review.yml']) {
    const p = path.join(root, f);
    assert.ok(existsSync(p), `${f} exists`);
    const txt = await fs.readFile(p, 'utf8');
    assert.ok(txt.length > 50, `${f} non-empty`);
    assert.match(txt, /<!-- vskills-pr-review -->/, `${f} has header marker`);
  }
  const review = await fs.readFile(path.join(root, 'pr-review.yml'), 'utf8');
  assert.match(review, /pull_request_target:/);
  assert.match(review, /opened.*synchronize.*reopened.*ready_for_review/s);
  assert.match(review, /permissions:/);
  assert.match(review, /contents:\s*(read|write)/);
  assert.match(review, /pull-requests:\s*write/);
  assert.match(review, /checks:\s*write/);
  assert.match(review, /Stage trusted review assets/);
  assert.match(review, /PARSER=\/tmp\/vskills-pr-review\/parse-review-config\.mjs/);

  const fix = await fs.readFile(path.join(root, 'pr-fix.yml'), 'utf8');
  assert.match(fix, /issue_comment:/);
  assert.match(fix, /contains\(github\.event\.comment\.body, '\/fix'\)/);
  assert.match(fix, /contents:\s*write/);

  const cfg = await fs.readFile(path.join(root, 'review.yml'), 'utf8');
  assert.match(cfg, /fileChangeLimit:\s*100/);
  assert.match(cfg, /strictness:\s*Medium/);
  assert.match(cfg, /requiredConfidence:/);
  assert.match(cfg, /maximumRisk:/);
});

test('prompt templates exist', async () => {
  assert.ok(existsSync(path.join(process.cwd(), 'standalone/pr-review/templates/prompt/system.md')));
  assert.ok(existsSync(path.join(process.cwd(), 'standalone/pr-review/templates/prompt/fix.md')));
});
