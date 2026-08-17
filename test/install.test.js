import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlinkTypeForPlatform } from '../src/install.js';

test('symlinkTypeForPlatform uses junctions on Windows', () => {
  assert.equal(symlinkTypeForPlatform('win32'), 'junction');
});

test('symlinkTypeForPlatform leaves non-Windows platforms autodetected', () => {
  assert.equal(symlinkTypeForPlatform('darwin'), undefined);
  assert.equal(symlinkTypeForPlatform('linux'), undefined);
});
