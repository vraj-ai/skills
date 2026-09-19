---
name: test-tps
version: 1.0.0
description: User-invoked benchmark for selected Pi provider/model. Measures TTFT, decode TPS, average TPS, latency, token usage, and aggregate percentiles. Use when user runs /skill:test-tps.
disable-model-invocation: true
argument-hint: "[--runs N] [--warmup N] [--output-tokens N] [--provider ID] [--model ID] [--json]"
---

# Test TPS

Benchmark selected Pi model. Invocation spends provider quota and may incur cost.

## Run

Resolve this skill directory, then run:

```bash
node <skill-dir>/scripts/test-tps.mjs <arguments>
```

Defaults: `PI_PROVIDER`, `PI_MODEL`, current reasoning level, 3 measured runs, 1 warmup, 256 requested output tokens.

Report command output verbatim. Do not reinterpret `N/A` metrics. Prefill TPS is `N/A` unless provider telemetry exposes prompt-processing duration. TTFT is latency, not prefill duration. Requested output tokens are a prompt target because Pi's CLI exposes no generic per-request max-output flag.

## Rules

- Use current selected provider/model unless arguments override them.
- Preserve failed-run messages.
- Never print credentials or auth files.
- For stable comparisons, keep provider, model, reasoning, prompt, run count, and output target identical.
