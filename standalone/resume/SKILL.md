---
name: resume
version: 1.0.0
description: Pick up in-flight work left by a prior session or another agent — re-establish the real state from the snapshot, branch, and tracker, verify which claims still hold, and continue from the proven position rather than the reported one. Use when resuming paused work, taking over a task another agent started, or when a snapshot's resume instruction is in hand.
dependencies: [principle-evidence-over-report]
disable-model-invocation: true
argument-hint: "[snapshot-note-or-task]"
recommended: false
---

# Resume

The other half of snapshot: snapshot checkpoints the work, resume picks it up.
The prior session's claims are a starting pointer, not ground truth — the repo
is right, so re-prove the position before building on it.

## Step 1 — Read the pointer, then the reality

Take the snapshot note, handoff, or ticket reference and extract: objective,
worktree, branch, head SHA, uncommitted work, last verification, next action.

Then check each claim against the repo, in this order:

1. `git status -sb` and `git log` — does the branch still hold the claimed head?
   Did anything land since?
2. The tracker item — current state and any comments added after the note.
3. The claimed verification — does the gate still pass at the current head?

Where the note and the repo disagree, the repo is right and the note was a
report — say so and continue from the proven position.

## Step 2 — Rebuild only the missing context

Load what the next action needs, not the whole prior session: the files the
diff touches, the failing check's output, the unresolved decision. A resume
that re-reads everything wastes the checkpoint; one that re-reads nothing
inherits every stale assumption.

Confirm authority before acting: the note's authority claims (push, merge,
comment) expire with the session that held them. Only currently granted
authority applies.

## Step 3 — Continue from the proven position

- Claims verified, next action still valid → proceed with it.
- Claims verified, next action stale (landed, superseded, blocked elsewhere) →
  re-derive the next action from the tracker's real state and say what changed.
- Claims broken (branch moved, gate red at claimed-green head) → treat the gap
  as new work: investigate or debug what drifted before resuming the plan.

Report: which prior claims held, which didn't, and the action actually taken.
