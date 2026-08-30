#!/usr/bin/env node
import { copyPrReview } from '../../../pr-review/scripts/copy.mjs';
import path from 'node:path';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';

export { copyPrReview };

export async function writeReviewConfig(targetRoot, { provider='none', baseUrl='', model='gpt-4o-mini', auth='none', secretName='OPENAI_API_KEY', strictness='Medium', requiredConfidence=2, maximumRisk='Low' }={}){
  const cfgPath = path.join(targetRoot, '.vskills/review.yml');
  let existing='';
  try{ existing = await fs.readFile(cfgPath, 'utf8'); } catch(e){ if(e.code!=='ENOENT') throw e; }
  if(existing) return 'skipped-exists';
  const src = path.join(targetRoot, '../../../standalone/pr-review/templates/review.yml');
  // fallback to repo templates
  const repoRoot = path.resolve(import.meta.dirname ? import.meta.dirname : path.dirname(new URL(import.meta.url).pathname), '../../..');
  const src2 = path.join(repoRoot, 'standalone/pr-review/templates/review.yml');
  const template = await fs.readFile(existsSync(src2) ? src2 : src, 'utf8');
  let out = template;
  // inject choices without storing secrets
  out = out.replace(/provider:\s*none/, `provider: ${provider}`);
  out = out.replace(/auth:\s*none/, `auth: ${auth}`);
  if(baseUrl) out = out.replace(/baseUrl:\s*""/, `baseUrl: "${baseUrl}"`);
  out = out.replace(/model:\s*"gpt-4o-mini"/, `model: "${model}"`);
  out = out.replace(/secretName:\s*"OPENAI_API_KEY"/, `secretName: "${secretName}"`);
  out = out.replace(/strictness:\s*Medium/, `strictness: ${strictness}`);
  out = out.replace(/requiredConfidence:\s*2/, `requiredConfidence: ${requiredConfidence}`);
  out = out.replace(/maximumRisk:\s*Low/, `maximumRisk: ${maximumRisk}`);
  await fs.mkdir(path.dirname(cfgPath), {recursive:true});
  await fs.writeFile(cfgPath, out, 'utf8');
  return 'installed';
}

if(import.meta.url===`file://${process.argv[1]}`){
  const target = process.argv[2] || process.cwd();
  copyPrReview({targetRoot: path.resolve(target)}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exit(1)});
}
