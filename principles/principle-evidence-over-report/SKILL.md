---
name: principle-evidence-over-report
version: 1.0.0
description: When a report and the repository disagree — a worker claims success with no commit, a tracker says done but the gate is red — the repo is right and the report is narrative. Apply whenever consuming status from tickets, workers, comments, dashboards, or pipeline state.
recommended: false
---

# Principle: evidence over report

Any channel that carries status can carry a false green. The tracker, the
comment, the worker's summary, and the pipeline badge are all reports about the
system. The repo is the system. When they disagree, the repo is right.

## False-green smells

| Smell | What it actually means |
|---|---|
| A worker reports success but there is no commit, no state change, no artifact | Nothing happened. The report is narrative. |
| The ticket is in an implementing state but the production entry point bypasses the tested seam | The test proves nothing about the shipped path |
| The locked verification command references a harness that does not exist | The gate was never runnable; nobody ran it |
| State says done but the gate is red on a fresh checkout | The state was moved without proof |
| Repeated retries produce identical failure output | No new information is being generated — burn without learning |

## The re-read order

When a smell fires, re-read reality before touching code:

1. The ticket — current state, full body, all comments, bounces especially.
2. The plan or spec it points at.
3. The production entry point — does real traffic reach the code under test?
4. The gate — run it, right now, and record the real output.
5. `git log --oneline -10` and `git status -sb` — what actually landed?

## Where reports still count

Reports are evidence about the reporter, not about the work. A worker that
reports success with no diff is a finding about that worker's verification, not
about the task. Record the discrepancy; do not silently reconcile it.

State corrections belong to whoever owns the state machine. Fix the artifact or
the ticket field through the authorized path; do not edit status to match hope.
