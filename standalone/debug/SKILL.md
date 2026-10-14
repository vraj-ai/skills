---
name: debug
version: 1.0.0
description: Root-cause a defect from observable evidence — reproduce it first, isolate the variable that decides the failure, fix at the cause rather than the symptom, and prove the fix with the failing case itself. Use to find the cause of a bug, a regression, a crash, a flaky or flaking test, a UI drift or glitch, an idle-CPU or timing bug, a "users report X" report, or any behavior that's wrong where the cause or the why is not already known.
dependencies: [principle-real-artifact, principle-bounded-repair]
recommended: false
---

# Debug

A defect gets reproduced before it gets theories. The failing case is the
specification; everything else is guessing.

## Step 1 — Reproduce

Build the smallest deterministic trigger: a command, a test, a request that
fails the same way the report describes. No reproduction yet means the work is
still investigation — use investigate to find the path, then come back.

Record the reproduction verbatim: input, expected, actual, and the environment
it depends on. A fix verified against a different failure proves nothing.

## Step 2 — Isolate, don't stare

Narrow the space instead of reading more code:

- Bisect inputs, commits (`git bisect`), or layers until the variable that
  decides pass/fail is identified.
- At each narrowing, write down what was eliminated and what remains — the log
  is the deliverable if the cause stays unfound.
- Prefer runtime evidence over code reading: a log line, a breakpoint, a
  diffed output beats another hour of staring.

## Step 3 — Fix the cause, not the symptom

The fix belongs at the point where the wrong value or decision originates —
not downstream where it becomes visible. A symptom-level fix leaves the cause
live for the next caller. If the root cause sits in a boundary that is out of
scope for the task, report it as a finding rather than papering over it.

## Step 4 — Prove it with the failing case

The reproduction itself becomes the regression test where the project's
testing conventions allow it. Red first: watch it fail on the unfixed code,
then pass on the fix. principle-bounded-repair governs the loop: identical
failure twice means the hypothesis changed nothing — rethink or stop.

For flaky failures, one green run is not a verdict. State the flake rate and
how many runs were observed; use principle-real-artifact — the check is the
repeated real run, not the absence of recent red.

## Report

- The reproduction, the root cause, and the evidence chain between them.
- The fix and the failing case that proves it.
- Adjacent defects found on the way, reported — not folded into the diff.
