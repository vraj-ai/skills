#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const DEFAULT_PROMPT = 'Output lowercase token only, separated by one space. Continue until the output limit. No punctuation, headings, code blocks, explanation, or early stop.';

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function summarize(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return {
    min: Math.min(...clean),
    max: Math.max(...clean),
    mean: clean.reduce((sum, value) => sum + value, 0) / clean.length,
    median: percentile(clean, 0.5),
    p50: percentile(clean, 0.5),
    p95: percentile(clean, 0.95),
  };
}

export function parseJsonLines(text) {
  const events = [];
  const errors = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      errors.push(`line ${index + 1}: invalid JSON`);
    }
  }
  return { events, errors };
}

export function deriveMetrics(events, startedAtMs = 0, endedAtMs = 0, tokenTimesMs = []) {
  const messageEnd = [...events].reverse().find((event) => event.type === 'message_end' && event.message?.role === 'assistant');
  const message = messageEnd?.message;
  const usage = message?.usage ?? {};
  const latencyMs = Math.max(0, endedAtMs - startedAtMs);
  const firstTokenMs = tokenTimesMs.length ? tokenTimesMs[0] - startedAtMs : null;
  const decodeMs = tokenTimesMs.length > 1 ? tokenTimesMs.at(-1) - tokenTimesMs[0] : null;
  const outputTokens = finiteOrNull(usage.output);
  // ponytail: generic Pi JSON cannot recover hidden prefill duration; add provider adapters only when exact prefill TPS is required.
  const promptDurationMs = findPromptDurationMs(messageEnd) ?? findPromptDurationMs(message);
  return {
    ok: Boolean(message) && message.stopReason !== 'error' && message.stopReason !== 'aborted',
    stopReason: message?.stopReason ?? 'missing',
    error: message?.errorMessage ?? null,
    inputTokens: finiteOrNull(usage.input),
    outputTokens,
    totalTokens: finiteOrNull(usage.totalTokens),
    cacheReadTokens: finiteOrNull(usage.cacheRead),
    cacheWriteTokens: finiteOrNull(usage.cacheWrite),
    reasoningTokens: finiteOrNull(usage.reasoning),
    costUsd: finiteOrNull(usage.cost?.total),
    latencyMs,
    ttftMs: firstTokenMs,
    promptDurationMs,
    prefillTps: outputRate(usage.input, promptDurationMs),
    decodeTps: outputRate(outputTokens, decodeMs),
    averageTps: outputRate(outputTokens, latencyMs),
  };
}

function findPromptDurationMs(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['promptDurationMs', 'prompt_duration_ms', 'promptEvalDurationMs', 'prefillDurationMs']) {
    if (Number.isFinite(value[key]) && value[key] > 0) return value[key];
  }
  for (const key of ['prompt_eval_duration', 'promptDurationNs', 'prompt_duration_ns']) {
    if (Number.isFinite(value[key]) && value[key] > 0) return value[key] / 1e6;
  }
  for (const nested of Object.values(value)) {
    const found = findPromptDurationMs(nested);
    if (found !== null) return found;
  }
  return null;
}

function outputRate(tokens, durationMs) {
  return Number.isFinite(tokens) && tokens >= 0 && Number.isFinite(durationMs) && durationMs > 0
    ? tokens / (durationMs / 1000)
    : null;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function parseArgs(argv) {
  const options = {
    provider: process.env.PI_PROVIDER,
    model: process.env.PI_MODEL,
    reasoning: process.env.PI_REASONING_LEVEL || 'off',
    runs: 3,
    warmup: 1,
    outputTokens: 256,
    timeoutMs: 180000,
    prompt: DEFAULT_PROMPT,
    json: false,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--provider') options.provider = requiredValue(argv, ++index, arg);
    else if (arg === '--model') options.model = requiredValue(argv, ++index, arg);
    else if (arg === '--reasoning') options.reasoning = requiredValue(argv, ++index, arg);
    else if (arg === '--prompt') options.prompt = requiredValue(argv, ++index, arg);
    else if (arg === '--runs') options.runs = positiveInteger(requiredValue(argv, ++index, arg), arg);
    else if (arg === '--warmup') options.warmup = nonNegativeInteger(requiredValue(argv, ++index, arg), arg);
    else if (arg === '--output-tokens') options.outputTokens = positiveInteger(requiredValue(argv, ++index, arg), arg);
    else if (arg === '--timeout-ms') options.timeoutMs = positiveInteger(requiredValue(argv, ++index, arg), arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.provider || !options.model) throw new Error('No selected provider/model. Select one in Pi or pass --provider and --model.');
  return options;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

function positiveInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${flag} must be a positive integer`);
  return number;
}

function nonNegativeInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${flag} must be a non-negative integer`);
  return number;
}

export function buildPiArgs(options) {
  return [
    '--mode', 'json', '--no-session', '--no-tools', '--no-skills', '--no-prompt-templates', '--no-context-files',
    '--provider', options.provider, '--model', options.model, '--thinking', options.reasoning,
    `${options.prompt}\nTarget about ${options.outputTokens} output tokens.`,
  ];
}

async function runSample(options, index, warmup) {
  const args = buildPiArgs(options);
  if (options.dryRun) return { index, warmup, command: ['pi', ...args] };
  return new Promise((resolve) => {
    const startedAtMs = performance.now();
    const tokenTimesMs = [];
    let stdout = '';
    let stderr = '';
    const child = spawn('pi', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs);
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const type = event.assistantMessageEvent?.type;
          if ((type === 'text_delta' || type === 'thinking_delta') && event.assistantMessageEvent.delta) tokenTimesMs.push(performance.now());
        } catch {}
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ index, warmup, ok: false, error: error.message });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const endedAtMs = performance.now();
      if (buffer.trim()) stdout += buffer.endsWith('\n') ? '' : '\n';
      const parsed = parseJsonLines(stdout);
      const metrics = deriveMetrics(parsed.events, startedAtMs, endedAtMs, tokenTimesMs);
      resolve({
        index,
        warmup,
        ...metrics,
        ok: code === 0 && metrics.ok,
        exitCode: code,
        signal,
        parseErrors: parsed.errors,
        stderr: stderr.trim() || null,
      });
    });
  });
}

export function aggregate(samples) {
  const successful = samples.filter((sample) => sample.ok && !sample.warmup);
  const failed = samples.filter((sample) => !sample.ok);
  const metric = (key) => summarize(successful.map((sample) => sample[key]).filter(Number.isFinite));
  return {
    successfulRuns: successful.length,
    failedRuns: failed.length,
    latencyMs: metric('latencyMs'),
    ttftMs: metric('ttftMs'),
    prefillTps: metric('prefillTps'),
    decodeTps: metric('decodeTps'),
    averageTps: metric('averageTps'),
    inputTokens: summarize(successful.map((sample) => sample.inputTokens).filter(Number.isFinite)),
    outputTokens: summarize(successful.map((sample) => sample.outputTokens).filter(Number.isFinite)),
    totalTokens: summarize(successful.map((sample) => sample.totalTokens).filter(Number.isFinite)),
    reasoningTokens: summarize(successful.map((sample) => sample.reasoningTokens).filter(Number.isFinite)),
    costUsd: summarize(successful.map((sample) => sample.costUsd).filter(Number.isFinite)),
  };
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'N/A';
}

function formatSummary(summary, unit = '') {
  if (!summary) return 'N/A';
  return `mean ${formatNumber(summary.mean)}${unit}, median ${formatNumber(summary.median)}${unit}, p50 ${formatNumber(summary.p50)}${unit}, p95 ${formatNumber(summary.p95)}${unit}, min ${formatNumber(summary.min)}${unit}, max ${formatNumber(summary.max)}${unit}`;
}

export function formatMarkdown(result) {
  const lines = [
    '# TPS benchmark', '',
    `- Provider: \`${result.provider}\``,
    `- Model: \`${result.model}\``,
    `- Reasoning: \`${result.reasoning}\``,
    `- Measured runs: ${result.aggregate.successfulRuns}/${result.runs}`,
    `- Warmup runs: ${result.warmup}`,
    `- Requested output tokens: ${result.outputTokens}`,
    '',
    '| Run | Input | Output | Reasoning | Total | Cache read | Cache write | TTFT ms | Latency ms | Prefill TPS | Decode TPS | Average TPS | Cost USD |',
    '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const sample of result.samples) {
    const label = sample.warmup ? `W${sample.index}` : sample.index;
    lines.push(`| ${label} | ${formatNumber(sample.inputTokens, 0)} | ${formatNumber(sample.outputTokens, 0)} | ${formatNumber(sample.reasoningTokens, 0)} | ${formatNumber(sample.totalTokens, 0)} | ${formatNumber(sample.cacheReadTokens, 0)} | ${formatNumber(sample.cacheWriteTokens, 0)} | ${formatNumber(sample.ttftMs)} | ${formatNumber(sample.latencyMs)} | ${formatNumber(sample.prefillTps)} | ${formatNumber(sample.decodeTps)} | ${formatNumber(sample.averageTps)} | ${formatNumber(sample.costUsd, 6)} |`);
  }
  lines.push('', '## Aggregates', '');
  lines.push(`- TTFT: ${formatSummary(result.aggregate.ttftMs, ' ms')}`);
  lines.push(`- Latency: ${formatSummary(result.aggregate.latencyMs, ' ms')}`);
  lines.push(`- Prefill TPS: ${formatSummary(result.aggregate.prefillTps)}`);
  lines.push(`- Decode TPS: ${formatSummary(result.aggregate.decodeTps)}`);
  lines.push(`- Average TPS: ${formatSummary(result.aggregate.averageTps)}`);
  lines.push(`- Input tokens: ${formatSummary(result.aggregate.inputTokens)}`);
  lines.push(`- Output tokens: ${formatSummary(result.aggregate.outputTokens)}`);
  lines.push(`- Reasoning tokens: ${formatSummary(result.aggregate.reasoningTokens)}`);
  lines.push(`- Total tokens: ${formatSummary(result.aggregate.totalTokens)}`);
  lines.push(`- Cost: ${formatSummary(result.aggregate.costUsd, ' USD')}`);
  if (!result.aggregate.prefillTps) lines.push('', '> Prefill TPS unavailable: provider stream exposed no prompt-processing duration. TTFT is not substituted.');
  const failures = result.samples.filter((sample) => !sample.ok);
  if (failures.length) {
    lines.push('', '## Failures', '');
    for (const sample of failures) lines.push(`- Run ${sample.warmup ? `W${sample.index}` : sample.index}: ${sample.error || sample.stderr || sample.stopReason || `exit ${sample.exitCode}`}`);
  }
  return lines.join('\n');
}

function help() {
  return `Usage: test-tps.mjs [options]\n\n--runs N           measured runs, default 3\n--warmup N         warmup runs, default 1\n--output-tokens N  requested output target, default 256\n--provider ID      defaults to PI_PROVIDER\n--model ID         defaults to PI_MODEL\n--reasoning LEVEL  defaults to PI_REASONING_LEVEL or off\n--prompt TEXT      fixed benchmark prompt\n--timeout-ms N     per-run timeout, default 180000\n--json             emit JSON\n--dry-run          print child commands without requests`;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return console.log(help());
  console.error(`Benchmark sends ${options.warmup + options.runs} requests to ${options.provider}/${options.model}; quota and charges may apply.`);
  const samples = [];
  for (let index = 1; index <= options.warmup + options.runs; index++) {
    const warmup = index <= options.warmup;
    samples.push(await runSample(options, warmup ? index : index - options.warmup, warmup));
  }
  if (options.dryRun) return console.log(JSON.stringify({ provider: options.provider, model: options.model, samples }, null, 2));
  const result = { ...options, samples, aggregate: aggregate(samples) };
  console.log(options.json ? JSON.stringify(result, null, 2) : formatMarkdown(result));
  if (!result.aggregate.successfulRuns) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`test-tps: ${error.message}`);
    process.exitCode = 1;
  });
}
