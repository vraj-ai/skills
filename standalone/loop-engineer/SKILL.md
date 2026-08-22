---
name: loop-engineer
version: 1.0.0
description: Run a coding task as a closed maker→checker loop with an explicit done-condition and rubric, iterating until the goal is verifiably met instead of stopping after one pass. Use when the user wants an agent loop, "loop engineering", a self-verifying build, maker-checker, "keep going until it's done/passes", autonomous iteration on a feature or bug, or asks to drive a task to a measurable finish line.
---

# Loop Engineer

Turn a coding task into a **closed loop** that runs until a goal is verifiably met, instead of a single best-effort pass. Based on the four-loop stack from LangChain's *The Art of Loop Engineering* (agent → verification → event-driven → hill-climbing).

The leverage is not the model — it's the loop you wrap around it. The single rule: **never declare done without the checker passing the done-condition.**

## Session topology

For the four-stage fleet, run the maker and checker in separate top-level stage-parent
sessions when possible. The current default parents are Opus 5/Claude Code for
planning, Kimi K3/Pi for coding, GPT-5.6 Luna/Codex at max effort for debugging, and
Grok 4.5/Pi for reviewing. A native child may not spawn nested children; use the
GitHub Project item, GitHub issue, git/PR artifacts, and handoffs to bridge sessions.

## Workflow

Run these in order. Loops 1–2 are the core; 3–4 are escalations.

### 1. Lock the goal (do this before any code)

Write a short **loop contract** at the top of your working notes:

- **Goal** — one sentence, the user-visible outcome.
- **Done-condition** — a *machine-checkable* gate. Prefer a command: `npm test`, `pytest -k feature`, `tsc --noEmit`, a curl returning 200, a screenshot diff. If it can't be checked by running something, rewrite it until it can.
- **Rubric** — 3–6 bullets the checker reviews against (correctness, edge cases, no regressions, matches existing patterns, no debug cruft). See [REFERENCE.md](REFERENCE.md) for a template.
- **Budget** — max iterations (default 5) and what to do on exhaustion (stop and report, don't thrash).

If the goal can't be made checkable, stop and ask the user — that's the one thing worth interrupting for.

### 2. Run the maker→checker loop

```
until done-condition passes OR budget exhausted:
  MAKER:   write the failing test first (or repro), then the smallest change toward the goal
  RUN:     execute the done-condition command
  CHECKER: review the result against the rubric with FRESH eyes —
           do not trust the maker's own claim of success.
           Output: PASS, or specific failing bullets + concrete next action.
  if PASS:    exit loop
  if FAIL:    feed the checker's notes back as the next maker instruction
```

Keep the **maker and checker mentally separate** — the checker re-reads the actual diff and re-runs the command; it does not rubber-stamp. This split is what makes the loop reliable. When a check is deterministic (tests, types, lint), run the real command — don't eyeball it.

### 3. Escalate to event-driven (optional)

When the loop should run unattended or on a trigger (every N minutes, on a state change, while you sleep), hand the contract to Claude Code's `/loop` skill — it re-fires the loop on an interval and re-invokes when tracked work finishes. Keep the same goal + done-condition; `/loop` becomes the outer crank.

### 4. Hill-climb the harness (optional)

After a run, spend one pass improving the *setup*, not the code: tighten the rubric, add the missing test that would have caught the bug, capture a reusable instruction. If it's a durable lesson, write it to memory or a project skill so the next loop starts smarter.

## Anti-patterns

- Declaring done because the maker *said* it works — always re-run the gate.
- A vague done-condition ("looks good") — make it a command.
- Infinite thrash — respect the budget; on exhaustion, stop and report what's blocking.
- Skipping the test-first step on bugs — write the repro before the fix.

See [REFERENCE.md](REFERENCE.md) for the four-loop model, a rubric template, and a worked example.
