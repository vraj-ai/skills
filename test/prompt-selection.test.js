import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretSelectionAnswer, parseNameList } from '../src/prompt-selection.js';

test('plain Enter (empty string) means accept the recommended set, never nothing', () => {
  assert.deepEqual(interpretSelectionAnswer(''), { recommended: true });
  assert.deepEqual(interpretSelectionAnswer('   '), { recommended: true });
});

test('"a" / "all" (any case) means install everything', () => {
  assert.deepEqual(interpretSelectionAnswer('a'), { all: true });
  assert.deepEqual(interpretSelectionAnswer('A'), { all: true });
  assert.deepEqual(interpretSelectionAnswer('all'), { all: true });
  assert.deepEqual(interpretSelectionAnswer('ALL'), { all: true });
});

test('"p" / "pick" defers to a follow-up question', () => {
  assert.deepEqual(interpretSelectionAnswer('p'), { pick: true });
  assert.deepEqual(interpretSelectionAnswer('pick'), { pick: true });
});

test('typing names directly at the first prompt works without going through "p"', () => {
  assert.deepEqual(interpretSelectionAnswer('alpha, beta'), { only: ['alpha', 'beta'] });
  assert.deepEqual(interpretSelectionAnswer('alpha beta'), { only: ['alpha', 'beta'] });
});

test('parseNameList splits on commas and/or whitespace and drops empties', () => {
  assert.deepEqual(parseNameList('alpha, beta,  gamma'), ['alpha', 'beta', 'gamma']);
  assert.deepEqual(parseNameList('alpha beta'), ['alpha', 'beta']);
  assert.deepEqual(parseNameList(''), []);
});
