---
name: investigate
version: 1.0.0
description: Answer a read-only question about the codebase — a walk-through of how a subsystem, queue, endpoint, webhook, or request flow works, where a behavior comes from, what a change could break — from source and runtime evidence, returning file pointers and an honest confidence level instead of a prose dump. Use for "how does X work", "where does Y happen", "what calls Z", blast-radius questions, and any task whose first step is understanding rather than changing.
recommended: false
---

# Investigate

A read-only pass. The deliverable is a map with evidence, not an essay — and
never a diff.

## Step 1 — Bound the question

State the question in one line and what would answer it: a named entry point, a
call chain, a data flow, the reason a decision was made. An investigation
without a stated question becomes a tour of whatever was opened first.

## Step 2 — Follow the evidence, not the filename

- Enter through the production entry point — the route handler, job, or
  callback real traffic uses — not the most central-looking file.
- Read callers before implementations. Where a symbol is used matters more to
  the answer than how it is written inside.
- Follow the actual call chain with grep and the harness's navigation; do not
  infer connections from naming similarity.
- For "why was it built this way", the evidence is in git log, linked
  issues/PRs, ADRs, and comments — in that order of reliability. When the
  record is silent, say the record is silent.

## Step 3 — Check claims against the real thing

Where the answer depends on runtime behavior, observe it: run the read-only
command, query the table, hit the endpoint. Reading code tells you what it
should do; only observation says what it does. Apply principle-real-artifact
when a claim in the answer would otherwise rest on a proxy.

For blast-radius questions, the answer must name the one fact the change is
safe because of — and that fact gets proven by running code or an existing
check, not asserted.

## Output

- The question, restated.
- The answer, with file:line pointers for each claim.
- The confidence level: proven, inferred, or unknown — and what would move it.
- Anything found that is broken or lying about its own state, reported as a
  finding, not fixed.

An investigation that edits code has stopped being an investigation. Findings
that need a fix become issues or ship input.
