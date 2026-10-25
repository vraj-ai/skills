---
name: land
version: 1.3.0
description: Drive open PRs to merged. Re-establish each PR's real state, resolve review threads, conflicts, failing checks, and CI failures under a bounded repair budget, land only the contiguous verified run bottom-up through the project's forge, watch until the checks pass and each merge lands, and stop at the ceiling. Use when a PR or a stack exists and the task is to get it merged, babysit it to merge-ready, or land it overnight or by morning.
dependencies: [push-handoff, principle-evidence-over-report, principle-independent-verdict, principle-bounded-repair, principle-real-artifact]
argument-hint: "[PR-or-stack]"
recommended: false
---

# Land

Ship ends at an open PR and continues here. Land owns the distance from open to merged. One rule governs everything below: **merge only what an independent verdict covers, land it in order, and keep hands off the rest of the stack.**

Invoking this skill never implies merge authority. push-handoff's authority model applies: merge, retarget, and force-push each happen only under an explicit user or repo-policy grant. Without one, land drives to merge-ready, reports, and does not merge.

When a ship record covers these PRs (format in ship's references/record.md, at `$(git rev-parse --git-common-dir)/vskills/ship/`), set its phase to land on entry and update its Work table after every merge, then run `node <install-root>/ship/scripts/ship-record.mjs <slug>`. Set the phase to done only when every recorded PR is merged. Merge-ready without merge authority stays at land, with Next naming who must merge. A ceiling with unverified PRs above it stays at land, with Next naming what the ceiling needs. Stopping mid-run is `/snapshot`. `/resume-work` re-enters at step 1, which re-establishes the real state anyway.

## Step 1. Establish the real state

For each PR in scope, read what the forge reports, then check it against the repo (principle-evidence-over-report):

- PR state, base branch, head SHA, review threads, check results.
- `git log` and `git status`: what actually landed locally, against what the tracker or the last report claims.
- Existing verdicts: who produced them, at which SHA, and whether the head has moved since (step 3).

Each open conflict, failing check, and unresolved review thread gets a named entry in the work list, not a paragraph of narrative.

## Step 2. Clear under a bounded repair budget

Work the list under principle-bounded-repair. Fix conflicts by rebasing onto the real base. Do not merge the target branch backwards unless repo policy says to. Answer each review thread once, with evidence or code, and resolve only the threads the answer actually covers. A CI failure gets a reproduced local failure first where the suite exists. A fix pushed blind costs a round-trip per guess.

Two identical CI failures in a row mean the loop is not learning. Change the hypothesis, or stop and report per the budget.

## Step 3. Verify before trusting a verdict

principle-independent-verdict: only a verdict from a context that did not write the code counts, and a verdict covers a patch, not a branch. Before landing any PR, confirm its verdict is current:

1. Compare the patch-id of the PR's *full diff* at the verdict's SHA and at the current head: `git diff <base>...<sha> | git patch-id`. The head commit's patch-id alone misses an earlier commit drifting under an unchanged tip patch.
2. Identical: the verdict stands. Identical except tests, docs, or lint config: it stands if the evidence still describes the code.
3. Anything else: the old verdict never saw this code. Get a fresh one from an independent reviewer agent, the PR review bot, or a human, per project convention.

A PR with no verdict is unverified, however green its CI.

## Step 4. Land the contiguous verified run, bottom-up

Walk up from the lowest unmerged PR. Stop at the first one without a current verdict. Everything below it is the run, and that PR is the ceiling.

1. Wait for the lowest PR's required checks to finish: `gh pr checks <pr> --watch`, the forge's equivalent, or the host's PR watcher (inside T3 Code, `watch_pull_request`, then end the turn). A failing check goes back to step 2.
2. Merge it with the project's forge (`gh pr merge`, the repo's own merge command, or the merge queue), one PR at a time. Respect the repo's merge style: squash, rebase, or merge commit.
3. Read the PR back after every merge command. A queued merge is not a merge. A landed PR reads merged, with trunk as its base, not its parent's branch.
4. When a merge lands, retarget the next verified PR in the run whose base was the merged branch. Point it at trunk and replay only its own patch with `git rebase --onto trunk <old parent tip> <branch>`, then push with `--force-with-lease`. After a squash merge, a plain rebase replays the parent's commits; `--onto` moves just the child's patch. The ceiling is not retargeted: it and everything above it stay exactly as they are. The verdict covered the patch, so apply step 3 to decide whether it survives the move.
5. Leave the rest of the stack alone while it lands. A base moving to trunk when its parent merges is expected, not damage to repair.
6. When a merge stalls, find out why before changing anything. A merge queue, a required review, and a branch protection rule each have a different fix.

## Step 5. Stop at the ceiling

Extending the run takes new verdicts, so it is a new pass from step 1, not more of this one. Report the verified run and its ceiling, each PR's verdict and who produced it, what landed and how it was confirmed, and what the next gap needs.

An overnight or unattended run reports per-merge evidence and stops at the first gap it cannot clear under its authority. It never widens authority to keep moving.
