---
name: goals
version: 1.3.0
description: Drive a plan document to verified completion through a resumable single-writer backlog, council research/review, worktree-isolated parallel builds, milestone gates, and a final adversarial teardown. Use when the user invokes /goal, asks to execute an architecture plan autonomously, resumes a goal, or needs a large issue set delivered milestone by milestone.
dependencies: [council, parallel, council-adversary]
---

# Goals

Within a goal run, `goals` is the only delivery orchestrator and the only
writer of `CONTEXT/goals/<slug>/backlog.jsonl`. It composes `parallel` for code and
`council` for contested research and review. Subagents emit evidence; they
never mutate the backlog.

**`goals` is the code review.** Two non-maker T0 reviewers apply `parallel`'s
review rubric to every item, and T1, T2, and T3 widen the same lenses. Running
a separate review skill afterwards re-reads work that has already been
reviewed.

## State contract

For plan `<plan-path>`, derive a stable `<slug>` and use:

```text
CONTEXT/goals/<slug>/
  goal.md
  backlog.jsonl
  handoff.md
  lock.d/owner.json
  reviews/M<n>.json
  reviews/T3.json
CONTEXT/worktrees/<slug>/
  results.json
  <id>.digest.json
  *.log
```

Every backlog line has at most these 12 fields:
`id`, `type`, `title`, `status`, `milestone`, `priority`, `source`,
`source_id`, `depends_on`, `acceptance`, `attempts`, `created_by`.

Use `delivery/goals/scripts/state.mjs` for locks, validation, ready calculation, and atomic
replacement. Never append or edit the backlog in place. Mirror backlog state
to GitHub issue labels when a GitHub remote is available, but resume from the
local backlog. Use exactly one `goals:*` state label per issue — one per
backlog status: `goals:planned`, `goals:ready`, `goals:in-progress`,
`goals:blocked`, `goals:failed`, `goals:done`, `goals:cancelled`. Remove the
old label in the same operation that adds the new one, create labels on demand
with `gh label create goals:<status> --force`, and never let a failed label
write block the run. Publish the 3-7 thematic groups as native GitHub
Milestones and open their issues; milestone size has no fixed issue cap. `ship`
publishes the same milestones and label vocabulary, but opens no issues of its
own.

## Context ownership contract

In a consumer project, durable context is bounded, single-owner, and
event-driven. Track only these artifacts; everything else is runtime state.

| Artifact                                          | Writer | Update trigger |
|---------------------------------------------------|--------|----------------|
| `AGENTS.md`                                       | human  | durable router change |
| `CONTEXT/architecture.md`                         | human  | locked decision / invariant / non-goal change |
| `CONTEXT/progress.md`                             | goals  | milestone completion or verified edit (derived pointer) |
| `CONTEXT/goals/<slug>/handoff.md`                 | goals  | batch, T1 gate, T3 gate, clean stop |
| `CONTEXT/goals/<slug>/reviews/M<n>.json`, `T3.json` | goals | T1 gate, T3 gate |

Runtime state, never tracked in a consumer project (these are paths beneath
that project's `CONTEXT/`): `CONTEXT/goals/<slug>/backlog.jsonl` (goal resume
state owned exclusively by `goals`), `lock.d/`, `CONTEXT/worktrees/<slug>/`,
`*.log`, `results.json`, and `<id>.digest.json`. The tracked artifacts above
are not ignored. The public vskills repository's own machine-local notes
(`CONTEXT.md`, `docs/`, `CONTEXT/`, `CLAUDE.md`) are local-only under that
repository's own `.gitignore`; that is a property of the vskills repo, not a
rule a consumer project applies to its own tracked `CONTEXT/`.

Rules:

- **One owner per artifact.** `goals` is the sole writer of goal backlogs, the
  handoff, `progress.md`, and review verdicts. `council`, reviewers, and
  contributors report documentation impact only; they never edit a context
  artifact or the backlog.
- **Event-driven updates.** Rewrite an artifact only when its trigger fires.
  No polling, no autonomous broad rewrites, no speculative refresh of the
  whole context tree.
- **Evidence over prose.** Every progress or handoff entry points at a test,
  build, review verdict, or commit. If there is no evidence, there is no
  durable change.
- **Bounded context.** `CONTEXT/progress.md` is a small derived pointer to the
  current milestone and last verified edit — never a diary, narrative, or
  resume source of truth. Goal backlogs and handoffs remain the resume.
- **vskills does not mutate consumer repos.** The CLI ships skills and regenerates
  this repo's local-only context only; no `docs-init` command, no writes into a
  consumer project's `CONTEXT/`.

## Session handoff artifact

Keep two handoff layers separate:

- `CONTEXT/goals/<slug>/handoff.md` is the compact, machine-readable goals
  resume cursor. It remains the source of truth for Phase R.
- A full human handoff is a temporary `$TMPDIR` document with the sections
  `Objective`, `Important Details`, `Work State`, `Next Move`, `Relevant Files`,
  and `Suggested Skills`. It summarizes the session without duplicating plans,
  issues, ADRs, commits, diffs, or test output.

At a clean stop, milestone stop, escalation, or verified completion, update the
goals cursor first, then emit the full handoff artifact. `push-handoff` may
deliver a project-owned copy later, but handoff creation never pushes.

## Preflight

Before mutation, verify the plan exists, the cwd is a Git worktree on a named
branch, `CONTEXT/worktrees` is writable, the verification commands are
runnable, and every configured model is reachable. Record the pre-goal merge
base. `MAX_BATCH` defaults to 3 and may never exceed 4.

For Desktop and terminal parity, resolve the CLI in this order:
`OPENCODE_BIN`, `~/.opencode/bin/opencode`, then `opencode` on `PATH`. Pin the
resolved value in `goal.md` and `handoff.md` when the CLI path is used.

If project state is missing, create it without overwriting existing files.
Apply the context ownership contract above: keep `AGENTS.md`,
`CONTEXT/architecture.md`, `CONTEXT/progress.md`, goal `handoff.md`, and
`reviews/*.json` trackable. Add only runtime paths (`backlog.jsonl`, `lock.d/`,
`CONTEXT/worktrees/<slug>/`, logs, `results.json`, and `*.digest.json`) to the
project's ignore rules.

## Phase R: resume first

Run Phase R before every other phase in every fresh session.

1. Atomically acquire `lock.d`. If it exists, stop unless its owner is proven
   stale. Never run two goal orchestrators for one slug.
2. If `backlog.jsonl` exists, this is a resume. Never reparse the plan.
3. Read `handoff.md`, then the backlog.
4. Reconcile every stale `in-progress` item from `results.json`, its digest,
   and `git merge-base --is-ancestor <branch> <MAIN_BRANCH>`. Never infer from
   chat, commit subjects, or elapsed time.
5. Recompute ready items from dependencies and enter the execution loop.

Generate one stable session id when acquiring the lock and use that same id to
release it. The helper refuses a non-owner unlock. A same-host lock whose PID is
provably dead may be recovered; malformed or remote-host locks require human
inspection.

## Phase 0: plan once

Only when no backlog exists:

1. Parse the plan into 3-7 thematic milestones and dependency-ordered `code`,
   `research`, and `verify` items.
2. Every code item locks one runnable Verification-command in `acceptance`.
3. Pin `MAIN_BRANCH`, `WORKTREE_ROOT`, pre-goal merge base, model roster, and
   goal success criteria in both `goal.md` and `handoff.md`.
4. Present the milestone/ticket plan once for human approval. Do not build
   before approval.
5. Atomically write the backlog, create/match GitHub Milestones and issues when
   available, and mirror their initial state labels without creating
   duplicates.

## Phase B: backlog sanity

Spawn exactly two council members (`council-grok` and `council-kimi`) in one
parallel tool message. One independent round only: no debate and no vote.
Both apply `COVERAGE / DUPLICATES / SCOPING / DEPENDENCIES / FEASIBILITY`.
Apply findings mechanically; additive evidence wins. Allow at most one rerun.

## Execution loop

Repeat until every item is `done` or `cancelled`:

1. Compute ready items whose dependencies are all `done`, preserving
   dependency order and the active milestone. Pass the handoff's explicit
   `milestone_cursor` to `state.mjs ready`; readiness must never cross a T1
   boundary.
2. Before spawning, flip the selected code ids to `in-progress` and atomically
   rewrite the backlog.
3. Send up to `MAX_BATCH` code items to `parallel`. Partial success is the
   default; one failed item must not sink green peers.
4. Run genuinely contested research through `council`. Do not council facts
   that one primary-source lookup can settle.
5. Run `verify` items directly. Tests and builds are deterministic work, not
   council work.
6. Ingest only `results.json` and `<id>.digest.json`, each kept to at most 30
   lines. Never ingest worker/reviewer transcripts; `.log` files are for
   humans.
7. Rewrite backlog and `handoff.md` atomically after every batch. A failed
   source id retains its attempt count; findings do not receive a fresh
   budget. Cap attempts at 2 per `source_id`, then escalate.

## T1: milestone gate

After all milestone items finish, run cheap checks first: no new test failures
against baseline, build passes, no conflict/TODO/stub markers, and every
deliverable exists. Reject mechanically before spending a model review.

Then invoke one rotating eligible council reviewer for integration scope only:
composition, cross-item coverage gaps, and plan drift, under the `structure`
lens of `parallel`'s review rubric. Item-level `over-build` and `slop` were
settled at T0 and are not re-litigated here. Rotate
`council-grok -> council-kimi -> council-qwen -> council-sol`; never repeat the
last reviewer and never use the GLM worker model. Record `PASS`,
`PASS-WITH-FOLLOWUPS`, or `FAIL` in `reviews/M<n>.json` and
`last_t1_reviewer` in the handoff.

After a passing T1, stop and show the milestone evidence. Wait for explicit
human continuation before starting the next milestone.

## T2 and T3

T2 reruns the final milestone mechanics against every plan success criterion
and performs a facts sweep. A whole-deliverable `council-adversary` pass is
optional at T2.

T3 is mandatory after T2. Invoke one read-only `council-adversary` on the full
cumulative MAIN_BRANCH diff from the pre-goal merge base, under all three lenses
of `parallel`'s review rubric, closing with `net: -<N> lines possible.` Require
`reviews/T3.json` with `SHIP`, `SHIP-WITH-FOLLOWUPS`, or `BLOCK`. Drain P0/P1
before completion; P2 may become labeled follow-up issues. A P0 `BLOCK`
escalates to the human. Mark the goal complete only after T3 and the locked
goal Verification-command both pass after the final edit/merge.

## Session discipline

After at least two batches, or one T1 gate with ready work remaining, the
session may checkpoint and stop cleanly with `Resume with Phase R`. Autonomy
is multi-session, not infinite context. Keep `handoff.md` irreducible:
`main_branch`, `worktree_root`, `milestone_cursor`, `last_t1_reviewer`, current
blocker, and `updated_at`; recompute everything else.

Release the lock on a clean stop or completion. Never release another live
orchestrator's lock.
