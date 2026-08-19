import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(__dirname, '..', 'package.json');

test('package metadata is ready for the vskills registry package', async () => {
  const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));

  assert.equal(packageJson.name, '@vskills/cli');
  assert.doesNotMatch(packageJson.description, /v-skills/);
  assert.match(
    packageJson.version,
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  );
  assert.equal(packageJson.bin?.vskills, 'bin/vskills.js');
  for (const field of ['repository', 'homepage', 'bugs']) {
    assert.equal(Object.hasOwn(packageJson, field), true);
    const value = packageJson[field];
    const reference = typeof value === 'string' ? value : value?.url;
    assert.equal(typeof reference, 'string');
    assert.match(reference, /github\.com\/vraj-ai\/skills(?:\.git)?(?:[/#]|$)/);
  }
  assert.equal(Object.hasOwn(packageJson, 'files'), false);
  assert.equal(Object.hasOwn(packageJson, 'dependencies'), false);
});
