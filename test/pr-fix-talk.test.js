import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('pr-fix.yml Collect has GH_TOKEN and fetches base', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-fix.yml'), 'utf8');
  assert.match(yml, /Collect context for fix/);
  assert.match(yml, /GH_TOKEN/);
  assert.match(yml, /git fetch origin/);
});

test('pr-fix.yml Call fix LLM uses qwen and talks', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-fix.yml'), 'utf8');
  assert.match(yml, /qwen\/qwen3\.8-flash|z-ai\/glm-5\.3-flash|deepseek\/deepseek-v4-flash/);
  assert.match(yml, /reasoning: \{effort: "low"\}/);
  assert.match(yml, /max_tokens: 2500/);
  assert.match(yml, /reply/);
  assert.match(yml, /Call fix LLM \(talk \+ patch\)/);
});

test('pr-fix.yml does not contain literal No auto-fixable copy-paste', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-fix.yml'), 'utf8');
  // The old literal was 'No auto-fixable changes found. Copy-paste prompt:' with \n escapes, now it should not appear as a literal body
  // We allow the fallback for no-LLM-key case which still has a similar message but via LLM, not the old literal
  // So we check that the old exact string with \n is not present
  assert.ok(!yml.includes('No auto-fixable changes found. Copy-paste prompt:\\n'), 'should not have old literal');
});

test('prompt fix.md requires reply+patch', async () => {
  const md = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/prompt/fix.md'), 'utf8');
  assert.match(md, /reply/);
  assert.match(md, /patch/);
  assert.match(md, /talk/);
});
