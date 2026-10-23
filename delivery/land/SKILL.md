---
name: land
version: 1.2.0
description: Drive open PRs to merged — re-establish each PR's real state, resolve review threads, conflicts, failing checks, and CI failures under a bounded repair budget, land only the contiguous verified run bottom-up through the project's forge, watch until the checks pass and each merge lands, and stop at the ceiling. Use when a PR or a stack exists and the task is to get it merged, babysit it to merge-ready, or land it overnight or by morning.
dependencies: [push-handoff, principle-independent-verdict, principle-bounded-repair, principle-real-artifact]
argument-hint: "[PR-or-stack]"
recommended: false
---

# Land

Ship ends at an open PR and continues here. Land owns the distance from open to
merged. The rule
that governs everything below: **merge only what an independent verdict covers,
land it in order, and keep hands off the rest of the stack.**

Merge authority is never implied by this skill's invocation — push-handoff's
authority model applies: merge, retarget, and force-push each happen only under
explicit user or repo policy grant. When authority is absent, land drives to
merge-ready and reports; it does not merge.

When a ship record covers these PRs (`$(git rev-parse --git-common-dir)/vskills/ship/`),
set its phase to land on entry and update its Work table after every merge.
Set it to done only when every recorded PR is merged. Merge-ready without merge
authority stays at land, with Next naming who must merge. A ceiling with unverified PRs above it stays at land, with Next
naming what the ceiling needs. Stopping mid-run is `/snapshot`. `/resume-work` re-enters at step 1,
which re-establishes the real state anyway.

## Step 1 — Establish the real state

For each PR in scope, read what the forge reports, then check it against the
repo — principle-evidence-over-report:

- PR state, base branch, head SHA, review threads, check results.
- `git log` and `git status` — what actually landed locally vs. what the
  tracker or the last report claims.
- Existing verdicts: who produced them, at which SHA, and whether the head has
  moved since (step 3).

Open conflicts, failing checks, and unresolved review threads each get a named
entry in the work list — not a paragraph of narrative.

## Step 2 — Clear under a bounded repair budget

Work the list under principle-bounded-repair. Fix conflicts by rebasing onto
the real base, not by merging the target branch backwards unless repo policy
says otherwise. Answer review threads with evidence or code, one reply per
thread; resolve only threads the answer actually covers. A CI failure gets a
reproduced local failure first where the suite exists — a fix pushed blind
costs a round-trip per guess.

Two identical CI failures in a row means the loop is not learning: change the
hypothesis or stop and report per the budget.

## Step 3 — Verify before trusting a verdict

principle-independent-verdict: only a verdict from a context that did not write
the code counts, and a verdict covers a patch, not a branch. Before landing any
PR, confirm the verdict is current:

1. Compare the patch-id of the PR's *full diff* at the verdict's SHA and at
   the current head: `git diff <base>...<sha> | git patch-id`. The head
   commit's patch-id alone misses an earlier commit drifting under an
   unchanged tip patch.
2. Identical — the verdict stands. Identical except tests, docs, or lint
   config — it stands if the evidence still describes the code.
3. Anything else — the old verdict never saw this code. Obtain a fresh one:
   independent reviewer agent, PR review bot, or a human, per project
   convention.

A PR with no verdict is unverified regardless of green CI.

## Step 4 — Land the contiguous verified run, bottom-up

Walk up from the lowest unmerged PR. Stop at the first one without a current
verdict: everything below is the run; that PR is the ceiling.

1. Merge the run's lowest PR first, one at a time, with the project's forge
   (`gh pr merge`, the repo's own merge command, or the merge queue). Respect
   repo merge style — squash, rebase, or merge commit.
2. Read the PR back after every merge command. A queued merge is not a merge;
   a landed PR reads merged with trunk as its base, not its parent's branch.
3. When a merge lands, retarget the next verified PR in the run whose base
   was the merged branch: point it at trunk and replay only its own patch —
   `git rebase --onto trunk <old parent tip> <branch>` — then push with
   `--force-with-lease`. A plain rebase replays the parent's commits when the
   merge was a squash; `--onto` moves just the child's patch. The ceiling is
   not retargeted — it and everything above it stay exactly as they are. The
   verdict covered the patch — apply step 3 to decide whether it survives the
   move.
4. Leave the rest of the stack alone while it lands. A base moving to trunk
   when its parent merges is expected, not damage to repair.
5. If a merge stalls, find out why before changing anything — a merge queue, a
   required review, or a branch protection rule each has a different fix.

## Step 5 — Stop at the ceiling

Extending the run takes new verdicts, so it is a new pass from step 1, not more
of this one. Report: the verified run and its ceiling, each PR's verdict and
who produced it, what landed and how it was confirmed, and what the next gap
needs.

An overnight or unattended run reports per-merge evidence and stops on the
first gap it cannot clear under authority — it never widens authority to keep
moving.
