import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(__dirname, '..', 'package.json');

test('package metadata is ready for the vskills registry package', async () => {
  const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));

  assert.equal(packageJson.name, 'vskills');
  assert.doesNotMatch(packageJson.description, /v-skills/);
  assert.match(
    packageJson.version,
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  );
  assert.equal(packageJson.bin?.vskills, 'bin/vskills.js');
  assert.equal(packageJson.repository, 'git+https://github.com/vraj-ai/skills.git');
  assert.equal(packageJson.homepage, 'https://github.com/vraj-ai/skills#readme');
  assert.equal(packageJson.bugs, 'https://github.com/vraj-ai/skills/issues');
  assert.equal(Object.hasOwn(packageJson, 'dependencies'), false);
});
