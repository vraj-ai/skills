import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregate,
  buildPiArgs,
  deriveMetrics,
  parseArgs,
  parseJsonLines,
  percentile,
  summarize,
} from '../standalone/test-tps/scripts/test-tps.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('skill is user-invoked and names test-tps', async () => {
  const skill = await fs.readFile(path.join(repo, 'standalone/test-tps/SKILL.md'), 'utf8');
  assert.match(skill, /name: test-tps/);
  assert.match(skill, /disable-model-invocation: true/);
  assert.match(skill, /Prefill TPS is `N\/A`/);
});

test('percentiles interpolate and summaries include required stats', () => {
  assert.equal(percentile([1, 2, 3, 4], 0.95), 3.8499999999999996);
  assert.deepEqual(summarize([1, 2, 3]), { min: 1, max: 3, mean: 2, median: 2, p50: 2, p95: 2.9 });
});

test('JSONL parser preserves good events and reports malformed lines', () => {
  const parsed = parseJsonLines('{"type":"agent_start"}\nnope\n{"type":"agent_end"}\n');
  assert.equal(parsed.events.length, 2);
  assert.deepEqual(parsed.errors, ['line 2: invalid JSON']);
});

test('metrics use provider prompt duration, streamed decode span, and wall time', () => {
  const events = [{
    type: 'message_end',
    telemetry: { promptDurationMs: 200 },
    message: {
      role: 'assistant',
      stopReason: 'stop',
      usage: { input: 100, output: 20, cacheRead: 3, cacheWrite: 4, reasoning: 5, cost: { total: 0.01 } },
    },
  }];
  const metrics = deriveMetrics(events, 1000, 3000, [1500, 2500]);
  assert.equal(metrics.ttftMs, 500);
  assert.equal(metrics.latencyMs, 2000);
  assert.equal(metrics.prefillTps, 500);
  assert.equal(metrics.decodeTps, 20);
  assert.equal(metrics.averageTps, 10);
});

test('missing prompt telemetry stays N/A instead of using TTFT', () => {
  const events = [{ type: 'message_end', message: { role: 'assistant', stopReason: 'stop', usage: { input: 100, output: 10, cost: { total: 0 } } } }];
  const metrics = deriveMetrics(events, 0, 2000, [500, 1500]);
  assert.equal(metrics.prefillTps, null);
  assert.equal(metrics.ttftMs, 500);
});

test('aggregate excludes warmups and failed samples', () => {
  const result = aggregate([
    { warmup: true, ok: true, decodeTps: 999 },
    { warmup: false, ok: true, decodeTps: 10, averageTps: 5, latencyMs: 1000, outputTokens: 5 },
    { warmup: false, ok: false, decodeTps: 0 },
  ]);
  assert.equal(result.successfulRuns, 1);
  assert.equal(result.failedRuns, 1);
  assert.equal(result.decodeTps.mean, 10);
});

test('arguments default to selected Pi model and build isolated child command', () => {
  const previous = { provider: process.env.PI_PROVIDER, model: process.env.PI_MODEL, reasoning: process.env.PI_REASONING_LEVEL };
  process.env.PI_PROVIDER = 'provider';
  process.env.PI_MODEL = 'model';
  process.env.PI_REASONING_LEVEL = 'high';
  try {
    const options = parseArgs(['--runs', '2', '--warmup', '0']);
    const args = buildPiArgs(options);
    assert.equal(options.provider, 'provider');
    assert.equal(options.model, 'model');
    assert.ok(args.includes('--no-tools'));
    assert.ok(args.includes('--no-session'));
    assert.ok(args.includes('--no-context-files'));
  } finally {
    restoreEnv('PI_PROVIDER', previous.provider);
    restoreEnv('PI_MODEL', previous.model);
    restoreEnv('PI_REASONING_LEVEL', previous.reasoning);
  }
});

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
