import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('README documents the registry install command without retracted npm guidance', async () => {
  const readme = await readFile(path.resolve(__dirname, '..', 'README.md'), 'utf8');

  assert.match(readme, /npx @vskills\/cli init/);
  assert.doesNotMatch(readme, /npm config set allow-git true/);
  assert.doesNotMatch(
    readme,
    /\bNode(?:['’]s|\s+versions?)?\b[^.]*\bautodetect(?:s|ed)?\b[^.]*\bjunction\b[^.]*\bneeds?\s+no\s+special\s+privileges\b/i,
  );
});
