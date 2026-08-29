---
name: ship
version: 1.4.0
description: Drive a published spec to verified, pushed completion through a resumable backlog, worktree-isolated parallel builds under a lazy-senior-dev ladder, gate-first review, a milestone reviewer, and a final adversarial teardown. Use when the user invokes /ship, asks to build out a spec autonomously, or resumes a ship run.
dependencies: [ship-parallel, council-adversary]
---

# Ship

`/ship` takes a spec reference and builds it, unattended, until a final adversary
says it can go — then pushes it.

It is the lean pipeline. Where `goals` gates and stops at every milestone,
`/ship` runs one builder and one reviewer per item, checks the gate before
spending either, and stops only for trouble. `goals` remains available for work
that earns the ceremony.

Start `/ship` with the spec reference. The handoff and push happen inside
`/ship`.


## Worker Roles

The Ship Orchestrator may spawn named Worker Roles one level deep through the
host's native mechanism:

- `researcher` — settle ordinary research and fact lookups.
- `builder` — complete each code item or isolated verification command.
- `reviewer` — report item and milestone findings without editing them.
- `adversary` — report the read-only T3 verdict.
- `small-task` — handle a bounded mechanical lookup or lane.

Workers never spawn. A `builder` commits only its item branch. Workers return
evidence and never write the backlog, lock, handoff, or push; the Orchestrator
alone owns those actions. Role names are host-neutral; do not use a host API,
path, or provider name as a Role identity. Use `council` only for a genuinely
contested fork, never for ordinary research, verification, or review.
**`/ship` is the code review.** Every item passes its locked gate and one
non-maker reviewer applying `ship-parallel`'s review rubric; the milestone gate
and T3 widen the same lenses. Running a separate review skill afterwards
re-reads work that has already been reviewed.


## Farm brief

`/ship` owns the worktree-isolated build farm. It composes the
`ship-parallel` skill for compatibility while keeping this brief and a copy of
the runner beside `/ship`. One item equals one branch and one worktree:

```text
git worktree add -b ship/<slug>/<id> CONTEXT/worktrees/ship/<slug>/<id>
  -> contributor builds to the ladder, commits
  -> ship runs the locked Verification-command
  -> green? one non-maker reviewer. red? straight back, no model spent
  -> merge to MAIN_BRANCH or report failure
```

The farm runner pins one contributor model. A model never reviews its own
code.

### The ladder

Pass this to every contributor, verbatim. It is the whole build brief.

> **Work down these rungs in order. Stop at the first one that solves it.**
>
> 1. **Necessity** — does this need to exist at all? (YAGNI)
> 2. **Codebase reuse** — is it already implemented in this project?
> 3. **Standard library** — does the stdlib solve it?
> 4. **Native platform** — can built-in features (CSS, HTML5 inputs, DB constraints) handle it?
> 5. **Existing dependencies** — use what is installed before adding anything
> 6. **One-liner** — can this be a single line?
> 7. **Minimal implementation** — only now, write the smallest thing that works
>
> **Never simplify away:** input validation at trust boundaries, error handling
> that prevents data loss, security measures, accessibility, or anything the
> acceptance criteria explicitly asked for. Lazy is not negligent.
>
> **Tests:** non-trivial logic requires at least one minimal runnable check
> (`assert`, `demo()`, or a single small test). Trivial code gets none. The
> locked Verification-command must pass. Write nothing beyond that.
>
> **No speculative abstractions** — no interface, factory, or config for a
> single call site. Fix root causes in shared code, not symptoms in callers.
> Prefer the compact diff and the fewest files.
>
> Mark deliberate trade-offs with a `ship:` comment naming the upgrade path.
> Report as: `[what you built] → skipped: [X], add when [Y].`

The ladder is adapted from [ponytail](https://github.com/DietrichGebert/ponytail)
(MIT, DietrichGebert). Interactive sessions can invoke the plugin directly;
this copy exists because worktree subagents may not load plugins.

### The review rubric

Pass this to every reviewer, verbatim, after the correctness brief. Correctness,
security, and data loss are judged first and keep their existing weight. What
follows is the quality pass, and it has three lenses.

> **over-build** — reinvented standard library, a dependency for what the
> platform already ships, an abstraction with one implementation, a factory with
> one product, config nobody sets, a wrapper that only delegates, a flag with one
> caller.
>
> **slop** — a comment restating the line below it, a defensive `try/catch` on a
> path that cannot fail, a cast that silences the compiler instead of fixing the
> type, nesting where a guard clause would return early, code whose shape does
> not match the file it was added to.
>
> **structure** — a new special case bolted into a flow that does not own it,
> feature logic living in a shared path, a bespoke helper duplicating one this
> repo already has, a file this diff pushed past the size the rest of the tree
> keeps.
>
> **One line per finding:** `<file>:<line>: <lens>: <what to cut>. <replacement>.`
>
> **A finding is admissible when it names the replacement** — a standard-library
> function, an existing symbol in this repo, a native platform feature, or
> `delete, nothing replaces it`. Name the replacement and the finding stands.
> Without one it is an opinion about taste, and taste does not block a merge.
>
> An admissible `over-build` or `structure` finding is **P1** and blocks the
> merge. `slop` is **P2**. Cap the quality pass at **5 findings**, ranked biggest
> cut first, and print `net: -<N> lines possible.` on its own line, or
> `Lean already.` for a clean item. **It goes immediately before `VERDICT:`**,
> never after `FOLLOWUPS:`: the result contract parses the last three lines, so
> a trailing net line displaces the verdict and invalidates the whole review.
>
> One runnable check per piece of non-trivial logic (`assert`, `demo()`, or one
> small test) is the required minimum and is never an `over-build` finding.
> Missing trust-boundary validation, data-loss handling, security,
> accessibility, or an unmet acceptance criterion stays P0/P1 under-build.

The rubric is adapted from [ponytail-review](https://github.com/DietrichGebert/ponytail)
(MIT, DietrichGebert), Cursor's `deslop` and `thermo-nuclear-code-quality-review`,
and [@elithrar](https://github.com/elithrar)'s `simplify`. It is inlined here for
the same reason the ladder is: worktree subagents may not load plugins.

### Batch input

`MAX_BATCH` defaults to 4 and is capped at 8. `/ship` marks all selected ids
`in-progress` atomically before invoking the farm. The CLI manifest is one line
per item:

```text
<id>|<branch>|<model>|<task prompt>
```

The task carries the plan/item path, exact acceptance criteria, the locked
Verification-command, `MAIN_BRANCH`, the absolute worktree path, and the ladder
above. Set `TEST_CMDS_JSON` to a complete JSON map from id to its locked
command; `TEST_CMD` is only accepted for a one-item batch. Reject any manifest
model other than the fixed contributor pin.

### Gate-first review and merge

- **Gate first.** Run the locked Verification-command before spending a model.
  A red gate is a failure on its own — report it and move on. Nothing to review.
- **One reviewer per green item**, a non-maker `reviewer` Worker Role,
  never the contributor's model. No verdict means no merge.
- Review items separately, never as a batch.
- Any evidenced P0/P1 blocks even if the reviewer mistakenly prints `PASS`.
- **Every reviewer applies the review rubric above** — the `over-build`, `slop`,
  and `structure` lenses, the named-replacement admissibility rule, and the
  `net: -<N>` close.
- `HARDENED=1` adds one read-only `council-adversary` pass on top.
- Partial success is default: merge green/PASS peers and report failed ids.
- `STRICT_BATCH=1` integrates on a temporary branch and fast-forwards
  `MAIN_BRANCH` only when the whole batch succeeds, so a late failure cannot
  leave earlier peers merged.
- `/ship` alone integrates. Workers commit only their item branch; reviewers do
  not edit; no child updates the backlog or issue labels.

Each reviewer emits:

```text
VERDICT: PASS | FAIL
FINDINGS: [{"severity":"P0|P1|P2|P3","file":"path:line","trigger":"...","wrong_behavior":"..."}]
FOLLOWUPS: []
```

For overlap, begin a no-commit merge. Keep both unique non-overlapping hunks.
For the same hunk, prefer the incoming branch only inside its declared
`files_touched`; otherwise prefer HEAD. Remove markers and run the locked
Verification-command. If still red, `git merge --abort`, mark that item failed,
and continue the wave. After a resolver edits the integration, materialize an
immutable candidate commit and rerun the review in a separate detached worktree
before committing the same tree.

### Results contract

Every batch atomically writes:

```json
{"main_branch":"...","merged":[{"name":"...","branch":"...","sha":"...","verdict":"PASS"}],"blocked":[],"failed":[],"conflicts":[]}
```

Every item writes a compact one-line `<id>.digest.json`:

```json
{"id":"...","verdict":"PASS|FAIL","files_touched":[],"tests":{"pass":0,"fail":0,"cmd":"..."},"findings":[],"followups":[]}
```

`/ship` ingests only these files, never logs. `results.json`, digests, branch
ancestry, and Git are producer truth for Phase R.

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
`CONTEXT/worktrees/ship` is writable, and every configured Worker Role is dispatchable.
Record the pre-ship merge base. `MAX_BATCH` defaults to 4 and may not exceed 8.


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
4. Pin `MAIN_BRANCH`, `WORKTREE_ROOT`, the pre-ship merge base, the Worker Role roster, and the success criteria in both `goal.md` and `handoff.md`.
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
3. Spawn up to `MAX_BATCH` `builder` Worker Roles through `ship-parallel` for
   code items. Partial success is the default: one failed item must not sink
   green peers. Each builder commits only its item branch.
4. Spawn a `researcher` Worker Role for each `research` item and a `builder`
   Worker Role for each `verify` item. Do not run ordinary research or
   verification in the parent; tests and builds are deterministic worker work.
5. Ingest only `results.json` and `<id>.digest.json`, each at most 30 lines.
   Never ingest worker or reviewer transcripts; `.log` files are for humans.
6. Rewrite the backlog and `handoff.md` atomically after every batch, then
   re-mirror every changed item's `goals:*` label. A failed source id retains
   its attempt count. Cap attempts at 2 per `source_id`, then escalate.

## Milestone gate

After all items in a milestone finish, run the cheap checks first and reject
mechanically before spawning a reviewer: no new test failures against baseline,
build passes, no conflict or TODO or stub markers, every deliverable exists.

Then spawn one read-only `reviewer` Worker Role for **integration scope only** —
whether the merged items compose, cross-item coverage gaps, and drift from the
spec, under the `structure` lens of `ship-parallel`'s review rubric: a special
case bolted into a flow that does not own it, feature logic in a shared path, a
helper duplicating one the repo already has. Item-level `over-build` and
`slop` were settled at the item gate and are not re-litigated here. Do not
reuse the same reviewer consecutively when the host exposes that choice, and
never use the maker's implementation. Record `PASS`, `PASS-WITH-FOLLOWUPS`, or
`FAIL` in `reviews/M<n>.json` and `last_reviewer` in the handoff. On `PASS` or
`PASS-WITH-FOLLOWUPS`, close the milestone in that same step.

**Continue straight into the next milestone.** A passing gate is not a reason to
stop and ask.

## T3: final gate

Mandatory. Spawn one read-only `adversary` Worker Role on the full cumulative
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
- **A hard blocker** — auth failure, unreachable Worker Role, unresolvable conflict.

On a genuinely contested call — two defensible designs and no evidence
separating them — do not decide silently. Stop and say: *"Contested: <the
fork>. Recommend `/council` on this before I continue."* `council` is only for
that contested fork, never for ordinary research, verification, or review.
When a finding is disputed rather than a design, spawn a fresh read-only
`reviewer` or `adversary` Worker Role. The user runs it; `/ship` resumes from
Phase R with the answer.

After at least two batches, the session may checkpoint and stop cleanly with
`Resume with Phase R`. Autonomy is multi-session, not infinite context. Keep
`handoff.md` irreducible: `main_branch`, `worktree_root`, `milestone_cursor`,
`last_reviewer`, current blocker, `updated_at`. Recompute everything else.
