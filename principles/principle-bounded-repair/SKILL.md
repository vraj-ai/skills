---
name: principle-bounded-repair
version: 1.0.0
description: Bound every repair loop — retrying an identical failure the same way burns budget without generating information. Set a repair budget before fixing, change the hypothesis or the observation when a retry fails the same way twice, and escalate to a blocker report when the budget expires instead of weakening acceptance. Apply during any fix loop, CI-chasing, or repeated verification failure.
recommended: false
---

# Principle: bounded repair

Retrying an identical failure is not persistence. It is a loop with no exit
condition.

## The rule

Before the first fix attempt, state the repair budget: how many rounds, what
counts as a round, and what happens when it expires. The pipeline default is
three rounds per issue unless the work states otherwise.

A round only counts if it produces new information: a different failure, a
narrowed reproduction, a changed hypothesis. Two consecutive rounds emitting
identical output mean the loop is not learning — change the hypothesis or the
observation method, or stop.

## When the budget expires

Report the blocker instead of weakening acceptance. An expired budget yields:

- What was tried, with the round each attempt happened on.
- The failure as it currently stands, verbatim where it matters.
- The hypothesis that remains untested and why.
- What unblocks it: a decision, an authority grant, an environment fix.

Do not lower the gate to match the diff. Do not reframe "cannot verify" as
"verified enough." A blocker stated cleanly is a successful outcome of a bounded
loop; an unverifiable "fix" is not.

## What does not count as repair

Re-running an unmodified gate after unrelated edits, watching the same flake a
second time to confirm it flakes, and re-reading evidence already collected all
cost little and lie outside the budget. The budget bounds *changes to the
system*, not observation of it.
