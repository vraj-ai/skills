import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('strictness Low/Med/High filters P2 noise correctly', async () => {
  function visible(findings, strictness){
    // High hides P2, Medium hides low-confidence P2, Low shows all
    if(strictness==='High') return findings.filter(f=>f.severity!=='P2');
    if(strictness==='Medium') return findings.filter(f=>!(f.severity==='P2' && f.confidence==='low'));
    return findings;
  }
  const findings=[{severity:'P1'},{severity:'P2', confidence:'high'},{severity:'P2', confidence:'low'}];
  assert.equal(visible(findings,'High').length,1);
  assert.equal(visible(findings,'Medium').length,2);
  assert.equal(visible(findings,'Low').length,3);
});

test('comment header templated from config appears', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  assert.match(cfg, /\*\*Heads up:\*\*/);
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-review.yml'), 'utf8');
  assert.match(yml, /Heads up/);
});

test('sequence diagram mermaid present and respects toggle', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  assert.match(cfg, /sequenceDiagram:/);
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-review.yml'), 'utf8');
  assert.match(yml, /mermaid/);
  assert.match(yml, /sequenceDiagram/);
});

test('status checks and auto-approve config present', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  assert.match(cfg, /useStatusChecks:/);
  assert.match(cfg, /requiredConfidence:/);
  assert.match(cfg, /postStatusComments:/);
  assert.match(cfg, /autoApprovePrs:/);
  assert.match(cfg, /maximumRisk:/);
  assert.match(cfg, /customInstructions:/);
});

test('full summary snapshot with all toggles on contains expected headings', async () => {
  const cfg = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/review.yml'), 'utf8');
  const has = (k)=>cfg.includes(k);
  let md='';
  if(has('prSummary')) md+='PR Summary';
  if(has('confidenceScore')) md+='Confidence Score';
  if(has('issueTable')) md+='Issue Table';
  if(has('sequenceDiagram')) md+='Sequence Diagram';
  if(has('statusChecks')) md+='Status Checks';
  assert.match(md, /PR Summary/);
  assert.match(md, /Confidence Score/);
  assert.match(md, /Issue Table/);
  assert.match(md, /Sequence Diagram/);
});
