---
name: ship
version: 1.2.0
description: Drive a published spec to verified, pushed completion through a resumable backlog, worktree-isolated parallel builds under a lazy-senior-dev ladder, gate-first review, a milestone reviewer, and a final adversarial teardown. Use when the user invokes /ship, asks to build out a spec autonomously, or resumes a ship run.
dependencies: [ship-parallel, council-adversary]
---

# Ship

`/ship` takes a spec reference and builds it, unattended, until a final adversary
says it can go — then pushes it.

It is the lean pipeline. Where `goals` councils, gates, and stops at every
milestone, `/ship` runs one contributor and one reviewer per item, checks the
gate before spending either, and stops only for trouble. `goals` remains
available for work that earns the ceremony.

Start `/ship` with the spec reference. The handoff and push happen inside
`/ship`.

**`/ship` is the code review.** Every item passes its locked gate and one
non-maker reviewer applying `ship-parallel`'s review rubric; the milestone gate
and T3 widen the same lenses. Running a separate review skill afterwards
re-reads work that has already been reviewed.

## Input

`/ship <reference>` takes an issue number, URL, or file path; fetch the spec from
that reference. If the repo has a tracker-location document, use it only as an
optional hint. With no argument, look for the most recent spec carrying the
`ready-for-agent` label — on GitHub that is `gh issue list --label ready-for-agent
--limit 1`. If no tracker is reachable, ask the user for the spec reference
rather than guessing.

Derive a stable `<slug>` from the spec's identifier (issue number + title slug,
or the filename). The slug is the resume key — pin it in `goal.md` and never
recompute it from a different source.

## State

`/ship` is the sole writer of everything under `CONTEXT/ship/<slug>/`.
Reviewers report findings; they never edit state.

```text
CONTEXT/ship/<slug>/
  goal.md            plan, locked gates, success criteria
  backlog.jsonl      runtime state
  handoff.md         resume cursor
  lock.d/owner.json
  reviews/M<n>.json  milestone verdicts
  reviews/T3.json    final adversary verdict
CONTEXT/worktrees/ship/<slug>/
  results.json
  <id>.digest.json
  *.log
```

Every backlog line has at most these 12 fields: `id`, `type`, `title`, `status`,
`milestone`, `priority`, `source`, `source_id`, `depends_on`, `acceptance`,
`attempts`, `created_by`.

Use `delivery/ship/scripts/state.mjs` for locks, validation, ready calculation, and
atomic replacement. It is the same contract `goals` uses, so a backlog written
by either is readable by both. Never append or edit the backlog in place.

Mirror backlog state to GitHub issue labels when a GitHub remote is available,
but **always resume from the local backlog** — labels are a view, never the
source of truth. Use the same `goals:*` vocabulary `goals` uses, one label per
status, and **exactly one `goals:*` label per issue** at any time. The
namespace is shared deliberately: the two pipelines share one backlog format
and one `state.mjs`, so an issue's state should not be named differently
depending on which pipeline drove it.

| backlog `status` | label |
|---|---|
| `planned` | `goals:planned` |
| `ready` | `goals:ready` |
| `in-progress` | `goals:in-progress` |
| `blocked` | `goals:blocked` |
| `failed` | `goals:failed` |
| `done` | `goals:done` |
| `cancelled` | `goals:cancelled` |

Rules:

- **Remove the old label in the same operation that adds the new one.** An
  issue carrying two `goals:*` labels is a corrupt view; if you find one,
  the backlog wins and the extra labels go.
- **Create labels on demand**, idempotently — `gh label create goals:<status>
  --force`. Never fail a run because a label is missing.
- **A label write never blocks the run.** No GitHub remote, no `gh`, no auth,
  or a rate limit means skip the mirror and keep building; record it in
  `handoff.md` rather than stopping.
- **Never read labels or milestones back as state.** Phase R reconciles from
  `backlog.jsonl`, `results.json`, digests, and branch ancestry only.
- Leave the spec's own triage label (`ready-for-agent`) alone; it belongs to
  whoever wrote the spec, not to this run.

### Milestones

Publish the plan's thematic groups as native GitHub Milestones, the same view
`goals` publishes. Milestone size has no fixed issue cap.

- **The title is the group's name; the backlog only keys it.** A backlog line's
  `milestone` is an id — `state.mjs ready` matches it against
  `milestone_cursor`, and `reviews/M<n>.json` is named for it. Pin each id's
  thematic name in `goal.md` at plan time and title the Milestone with that
  name, so the published view reads as the plan rather than as `M1`, `M2`.
- **Create or match by title, across open and closed milestones alike.** `gh`
  has no milestone command; use `gh api repos/{owner}/{repo}/milestones`. A
  resumed run whose gate already closed M1 has to match that closed milestone —
  searching only open ones makes it create a second M1, which GitHub rejects as
  a duplicate title and which would otherwise fail the run.
- **Attach an item's issue whenever the item first has one.** `/ship` opens no
  issue merely to fill a milestone; an item living only in the backlog stays
  there. That is the lean default.
- **Publishing degrades exactly as the label mirror above does**, and is skipped
  on the same conditions.

Track `goal.md`, `handoff.md`, and `reviews/*.json`. Add the rest —
`backlog.jsonl`, `lock.d/`, `CONTEXT/worktrees/ship/<slug>/`, logs, `results.json`,
`*.digest.json` — to the project's ignore rules.

## Preflight

Verify the spec resolves, the cwd is a Git worktree on a named branch,
`CONTEXT/worktrees/ship` is writable, and every configured model is reachable.
Record the pre-ship merge base. `MAX_BATCH` defaults to 4 and may not exceed 8.

Resolve the CLI in this order: `OPENCODE_BIN`, `~/.opencode/bin/opencode`, then
`opencode` on `PATH`. Pin the resolved value in `goal.md` and `handoff.md`.

## Phase R: resume first

Run Phase R before every other phase in every fresh session.

1. Atomically acquire `lock.d`. If it exists, stop unless its owner is proven
   stale. Never run two orchestrators for one slug.
2. If `backlog.jsonl` exists, this is a resume. Never reparse the spec.
3. Read `handoff.md`, then the backlog.
4. Reconcile every stale `in-progress` item from `results.json`, its digest, and
   `git merge-base --is-ancestor <branch> <MAIN_BRANCH>`. Never infer from chat,
   commit subjects, or elapsed time — and never from labels, which the previous
   session may have died halfway through writing.
5. Re-mirror the `goals:*` labels from the reconciled backlog, dropping any
   duplicate or contradictory label the interrupted session left behind. In
   the same pass, match each milestone by title and attach any item whose issue
   an interrupted session created the milestone without attaching.
6. Recompute ready items and enter the execution loop.

Generate one stable session id when acquiring the lock and use that same id to
release it. A same-host lock whose PID is provably dead may be recovered;
malformed or remote-host locks require human inspection.

## Phase 0: plan once

Only when no backlog exists.

1. Parse the spec into 3-7 thematic milestones and dependency-ordered `code`,
   `research`, and `verify` items. Each code item is a **tracer bullet** — a
   narrow but complete path through every layer, verifiable on its own, sized
   for one fresh context window.
2. **Wide refactors are the exception to tracer bullets.** A wide refactor is
   one mechanical change — rename a shared column, retype a shared symbol —
   whose blast radius fans across the codebase, so a single edit breaks
   thousands of call sites and no slice can land green. Sequence it as
   **expand-contract** instead. *Expand:* add the new form beside the old so
   nothing breaks. *Migrate:* move call sites over in batches sized by blast
   radius (per package, per directory), each batch its own item blocked by the
   expand, green batch to batch because the old form still exists. *Contract:*
   delete the old form once no caller remains, blocked by every migrate batch.
   Forcing this into tracer bullets makes every slice red and burns the attempt
   cap on a mechanical rename.
3. **Derive one runnable Verification-command per code item** and lock it in
   `acceptance`. The spec's Testing Decisions section is prose; read it together
   with the repo's test config (`package.json` scripts, test runner config, CI
   workflow) and write a real command that exits 0 exactly when the item is
   done — e.g. `npm test -- auth.spec && tsc --noEmit`. An item with no runnable
   gate is not ready.
4. Pin `MAIN_BRANCH`, `WORKTREE_ROOT`, the pre-ship merge base, the model
   roster, and the success criteria in both `goal.md` and `handoff.md`.
5. **Present the plan and its gates once, together, for approval.** Show every
   item with the command that will judge it. This is the only approval in the
   run — after it, the gates are locked and never re-asked.
6. Atomically write the backlog. Then publish the plan's milestones and mirror
   each item's initial state to its `goals:*` label, creating no duplicates of
   either. Always resume from the local backlog, never from the published view.

## Execution loop

Repeat until every item is `done` or `cancelled`.

1. Compute ready items whose dependencies are all `done`, preserving dependency
   order and the active milestone. Pass the handoff's `milestone_cursor` to
   `state.mjs ready`; readiness never crosses a milestone boundary.
2. Before spawning, flip the selected code ids to `in-progress`, atomically
   rewrite the backlog, then mirror the new state to their `goals:*` labels.
   The backlog write comes first: a crash between the two leaves a stale label,
   which Phase R corrects, whereas the reverse loses the state.
3. Send up to `MAX_BATCH` code items to `ship-parallel`. Partial success is the
   default: one failed item must not sink green peers.
4. Run `research` and `verify` items directly. One primary-source lookup settles
   most research; tests and builds are deterministic work.
5. Ingest only `results.json` and `<id>.digest.json`, each at most 30 lines.
   Never ingest worker or reviewer transcripts; `.log` files are for humans.
6. Rewrite the backlog and `handoff.md` atomically after every batch, then
   re-mirror every changed item's `goals:*` label. A failed source id retains
   its attempt count. Cap attempts at 2 per `source_id`, then escalate.

## Milestone gate

After all items in a milestone finish, run the cheap checks first and reject
mechanically before spending a model: no new test failures against baseline,
build passes, no conflict or TODO or stub markers, every deliverable exists.

Then invoke one rotating reviewer for **integration scope only** — whether the
merged items compose, cross-item coverage gaps, and drift from the spec, under
the `structure` lens of `ship-parallel`'s review rubric: a special case bolted
into a flow that does not own it, feature logic in a shared path, a helper
duplicating one the repo already has. Item-level `over-build` and `slop` were
settled at the item gate and are not re-litigated here. Rotate
`council-grok -> council-kimi -> council-qwen -> council-sol`; never repeat the
last reviewer, never use the contributor's model. Record `PASS`,
`PASS-WITH-FOLLOWUPS`, or `FAIL` in `reviews/M<n>.json` and `last_reviewer` in
the handoff. On `PASS` or `PASS-WITH-FOLLOWUPS`, close the milestone in that
same step.

**Continue straight into the next milestone.** A passing gate is not a reason to
stop and ask.

## T3: final gate

Mandatory. Invoke one read-only `council-adversary` on the full cumulative
`MAIN_BRANCH` diff from the pre-ship merge base, reviewing merged paths as a
composed system under all three lenses of `ship-parallel`'s review rubric, and
closing with `net: -<N> lines possible.` Require `reviews/T3.json` with `SHIP`,
`SHIP-WITH-FOLLOWUPS`, or `BLOCK`.

Drain P0/P1 before completion; P2 may become labelled follow-up issues. A `BLOCK`
escalates to the human and **never pushes**.

## Delivery

On `SHIP` or `SHIP-WITH-FOLLOWUPS`, with the locked success criteria passing
after the final merge:

1. Write the session document to `$TMPDIR` and update the `handoff.md` resume
   cursor.
2. `/push-handoff` — commit and push. Invoking `/ship` is the push authority its
   Step 0 requires. Report the fetched remote SHA as proof.

Release the lock.

## When to stop

`/ship` runs to T3 unattended. It stops for exactly three things:

- **T3 `BLOCK`** — report the P0 with its `file:line` evidence.
- **Attempt cap** — a `source_id` failed twice. Report both failures verbatim.
- **A hard blocker** — auth failure, unreachable model, unresolvable conflict.

On a genuinely contested call — two defensible designs and no evidence
separating them — do not decide silently and do not council by default. Stop and
say: *"Contested: <the fork>. Recommend `/council` on this before I continue."*
When a finding is disputed rather than a design, recommend `/council-adversary`
instead. The user runs it; `/ship` resumes from Phase R with the answer.

After at least two batches, the session may checkpoint and stop cleanly with
`Resume with Phase R`. Autonomy is multi-session, not infinite context. Keep
`handoff.md` irreducible: `main_branch`, `worktree_root`, `milestone_cursor`,
`last_reviewer`, current blocker, `updated_at`. Recompute everything else.
