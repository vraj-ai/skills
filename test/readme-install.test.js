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

test('README states the junction limitation beside the junction guarantee', async () => {
  const readme = await readFile(path.resolve(__dirname, '..', 'README.md'), 'utf8');

  // #28: junctions are NTFS reparse points and cannot target a network path, so
  // a folder-redirected %USERPROFILE% fails where the old symlink path worked.
  // Promising "neither Developer Mode nor an elevated shell" with no caveat
  // misleads exactly the corporate-laptop user the junction default is for.
  assert.match(readme, /UNC/);
  assert.match(readme, /non-NTFS/);

  // The guarantee may only appear alongside its limit.
  const guarantee = readme.indexOf('neither Developer Mode nor an elevated shell');
  const limit = readme.indexOf('Junctions do have one limit');
  assert.ok(guarantee !== -1, 'the junction guarantee went missing');
  assert.ok(limit > guarantee, 'the limitation must follow the guarantee it qualifies');

  // And the documented degraded behaviour must match src/install.js: fall back,
  // then warn and keep going rather than abort the whole init.
  assert.match(readme, /still installs into the install root/);
});
