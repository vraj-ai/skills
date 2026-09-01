import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFixResponse } from '../standalone/pr-review/scripts/parse-fix-response.mjs';

function envelope(message) {
  return JSON.stringify({ choices: [{ message }] });
}

test('fix response parser accepts strict JSON and rejects reasoning or unsafe output', () => {
  const patch = 'diff --git a/app.js b/app.js\n--- a/app.js\n+++ b/app.js\n@@ -1 +1 @@\n-old\n+new';
  assert.deepEqual(
    parseFixResponse(envelope({ content: JSON.stringify({ reply: 'Got it. I added the guard.', patch, notes: 'guard added' }) })),
    { reply: 'Got it. I added the guard.', patch, notes: 'guard added' },
  );
  assert.throws(
    () => parseFixResponse(envelope({ content: '```json\n{"reply":"No change needed.","patch":"","notes":"no-op"}\n```' })),
    /Unexpected token/,
  );
  assert.throws(() => parseFixResponse(envelope({ content: null, reasoning: 'We need answer the user.' })), /no content/);
  assert.throws(() => parseFixResponse(envelope({ content: '{"reply":"We need answer the user.","patch":"","notes":""}' })), /planning text/);
  assert.throws(() => parseFixResponse(envelope({ content: '{"reply":"Done.","patch":"--- a/app.js","notes":""}' })), /not a git unified diff/);
});
