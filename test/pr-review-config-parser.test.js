import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReviewConfig } from '../standalone/pr-review/scripts/parse-review-config.mjs';

test('review config parser reads nested values without matching comments', () => {
  const config = parseReviewConfig(`# requiredConfidence: 0\nwhen:\n  fileChangeLimit: 42 # bounded\nsummary:\n  confidenceScore:\n    enabled: false\ncomments:\n  strictness: High\n  header: "Review #1\\n---"\nstatusChecks:\n  useStatusChecks: true\n  requiredConfidence: 5\n  autoApprovePrs:\n    enabled: false\n    maximumRisk: Medium\n`);
  assert.equal(config.when.fileChangeLimit, 42);
  assert.equal(config.summary.confidenceScore.enabled, false);
  assert.equal(config.comments.strictness, 'High');
  assert.equal(config.comments.header, 'Review #1\n---');
  assert.equal(config.statusChecks.requiredConfidence, 5);
  assert.equal(config.statusChecks.autoApprovePrs.maximumRisk, 'Medium');
});
