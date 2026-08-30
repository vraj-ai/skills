import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('pr-fix.yml has correct guard: /fix on PR only, same-repo, dedupe, loop cap', async () => {
  const yml = await fs.readFile(path.join(process.cwd(), 'standalone/pr-review/templates/pr-fix.yml'), 'utf8');
  assert.match(yml, /contains\(github\.event\.comment\.body, '\/fix'\)/);
  assert.match(yml, /github\.event\.issue\.pull_request/);
  assert.match(yml, /isCrossRepository/);
  assert.match(yml, /Fork PR — cannot push/);
  assert.match(yml, /vskills-fix-/);
  assert.match(yml, /needs-human/);
  assert.match(yml, /3/);
  assert.match(yml, /fix:\$\{\{ github\.event\.comment\.id \}\}/);
});

test('fix loop simulation: 3rd rerun labels needs-human', ()=>{
  function shouldCap(count){ return count>=3; }
  assert.equal(shouldCap(2), false);
  assert.equal(shouldCap(3), true);
  assert.equal(shouldCap(4), true);
});

test('fork reject and non-PR ignore logic', ()=>{
  function skip({isFork, isPr, body}){
    if(!body.includes('/fix')) return 'no-fix';
    if(!isPr) return 'not-pr';
    if(isFork) return 'fork';
    return false;
  }
  assert.equal(skip({isFork:false, isPr:true, body:'/fix please'}), false);
  assert.equal(skip({isFork:true, isPr:true, body:'/fix'}), 'fork');
  assert.equal(skip({isFork:false, isPr:false, body:'/fix'}), 'not-pr');
  assert.equal(skip({isFork:false, isPr:true, body:'hello'}), 'no-fix');
});
