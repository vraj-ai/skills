#!/usr/bin/env node
import { readFile, mkdir, rename, open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');

function timestamp(){ return new Date().toISOString().replace(/[:.]/g,'-'); }

async function atomicInstall(source, target, backupRoot){
  const content = await readFile(source);
  let current = null;
  try{ current = await readFile(target); } catch(e){ if(e.code!=='ENOENT') throw e; }
  if(current?.equals(content)) return 'up-to-date';
  await mkdir(path.dirname(target), {recursive:true});
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  const h = await open(tmp, 'wx', 0o600);
  try{ await h.writeFile(content); await h.sync(); } finally{ await h.close(); }
  let backup=null;
  if(current){ await mkdir(backupRoot,{recursive:true}); backup=path.join(backupRoot, `${path.basename(target)}-${timestamp()}`); await rename(target, backup); }
  try{ await rename(tmp, target); } catch(e){ if(backup) await rename(backup, target).catch(()=>{}); throw e; }
  return current ? 'updated' : 'installed';
}

export async function copyPrReview({ targetRoot = process.cwd(), sourceRoot = path.join(repoRoot, 'standalone/pr-review/templates'), backupRoot = path.join(targetRoot, '.vskills-backup') } = {}){
  const results=[];
  results.push(await atomicInstall(path.join(sourceRoot,'pr-review.yml'), path.join(targetRoot,'.github/workflows/pr-review.yml'), backupRoot));
  results.push(await atomicInstall(path.join(sourceRoot,'pr-fix.yml'), path.join(targetRoot,'.github/workflows/pr-fix.yml'), backupRoot));
  results.push(await atomicInstall(path.join(sourceRoot,'prompt/system.md'), path.join(targetRoot,'.vskills/pr-review/system.md'), backupRoot));
  results.push(await atomicInstall(path.join(sourceRoot,'prompt/fix.md'), path.join(targetRoot,'.vskills/pr-review/fix.md'), backupRoot));
  results.push(await atomicInstall(path.join(repoRoot,'standalone/pr-review/scripts/parse-fix-response.mjs'), path.join(targetRoot,'.vskills/pr-review/parse-fix-response.mjs'), backupRoot));
  // review config: prefer .vskills/review.yml, don't overwrite if exists with different content? we backup
  const cfgSrc = path.join(sourceRoot,'review.yml');
  const cfgDst = path.join(targetRoot,'.vskills/review.yml');
  // if .vskills/review.yml exists, keep it (do not overwrite user config) — install only if missing
  if(!existsSync(cfgDst)){
    results.push(await atomicInstall(cfgSrc, cfgDst, backupRoot));
  } else {
    results.push('skipped-exists');
  }
  return results;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const target = process.argv[2] || process.cwd();
  copyPrReview({targetRoot: path.resolve(target)}).then(r=>{ console.log(JSON.stringify(r)); }).catch(e=>{ console.error(e); process.exit(1); });
}
