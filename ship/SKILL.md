---
name: ship
version: 1.0.0
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
CONTEXT/worktrees/<slug>/
  results.json
  <id>.digest.json
  *.log
```

Every backlog line has at most these 12 fields: `id`, `type`, `title`, `status`,
`milestone`, `priority`, `source`, `source_id`, `depends_on`, `acceptance`,
`attempts`, `created_by`.

Use `ship/scripts/state.mjs` for locks, validation, ready calculation, and
atomic replacement. It is the same contract `goals` uses, so a backlog written
by either is readable by both. Never append or edit the backlog in place.

Track `goal.md`, `handoff.md`, and `reviews/*.json`. Add the rest —
`backlog.jsonl`, `lock.d/`, `CONTEXT/worktrees/<slug>/`, logs, `results.json`,
`*.digest.json` — to the project's ignore rules.

## Preflight

Verify the spec resolves, the cwd is a Git worktree on a named branch,
`CONTEXT/worktrees` is writable, and every configured model is reachable. Record
the pre-ship merge base. `MAX_BATCH` defaults to 4 and may not exceed 8.

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
   commit subjects, or elapsed time.
5. Recompute ready items and enter the execution loop.

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
6. Atomically write the backlog. Mirror state to tracker labels where one
   exists, but always resume from the local backlog.

## Execution loop

Repeat until every item is `done` or `cancelled`.

1. Compute ready items whose dependencies are all `done`, preserving dependency
   order and the active milestone. Pass the handoff's `milestone_cursor` to
   `state.mjs ready`; readiness never crosses a milestone boundary.
2. Before spawning, flip the selected code ids to `in-progress` and atomically
   rewrite the backlog.
3. Send up to `MAX_BATCH` code items to `ship-parallel`. Partial success is the
   default: one failed item must not sink green peers.
4. Run `research` and `verify` items directly. One primary-source lookup settles
   most research; tests and builds are deterministic work.
5. Ingest only `results.json` and `<id>.digest.json`, each at most 30 lines.
   Never ingest worker or reviewer transcripts; `.log` files are for humans.
6. Rewrite the backlog and `handoff.md` atomically after every batch. A failed
   source id retains its attempt count. Cap attempts at 2 per `source_id`, then
   escalate.

## Milestone gate

After all items in a milestone finish, run the cheap checks first and reject
mechanically before spending a model: no new test failures against baseline,
build passes, no conflict or TODO or stub markers, every deliverable exists.

Then invoke one rotating reviewer for **integration scope only** — whether the
merged items compose, cross-item coverage gaps, and drift from the spec. Do not
re-review item code quality already covered at the item gate. Rotate
`council-grok -> council-kimi -> council-qwen -> council-sol`; never repeat the
last reviewer, never use the contributor's model. Record `PASS`,
`PASS-WITH-FOLLOWUPS`, or `FAIL` in `reviews/M<n>.json` and `last_reviewer` in
the handoff.

**Continue straight into the next milestone.** A passing gate is not a reason to
stop and ask.

## T3: final gate

Mandatory. Invoke one read-only `council-adversary` on the full cumulative
`MAIN_BRANCH` diff from the pre-ship merge base, reviewing merged paths as a
composed system. Require `reviews/T3.json` with `SHIP`, `SHIP-WITH-FOLLOWUPS`,
or `BLOCK`.

Drain P0/P1 before completion; P2 may become labelled follow-up issues. A `BLOCK`
escalates to the human and **never pushes**.

## Delivery

On `SHIP` or `SHIP-WITH-FOLLOWUPS`, with the locked success criteria passing
after the final merge:

1. `/handoff` — write the full session document to `$TMPDIR`, and update the
   `handoff.md` resume cursor.
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
