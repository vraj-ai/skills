---
name: goals
version: 1.5.0
description: Drive a plan document to verified completion through a resumable single-writer backlog, named Worker Role research and review, worktree-isolated parallel builds, milestone gates, and a final adversarial teardown. Use when the user invokes /goal, asks to execute an architecture plan autonomously, resumes a goal, or needs a large issue set delivered milestone by milestone.
dependencies: [council, council-adversary]
recommended: true
---

# Goals

Within a goal run, `goals` is the only delivery orchestrator and the only
writer of `CONTEXT/goals/<slug>/backlog.jsonl`, locks, and push. It composes
named Worker Roles for ordinary research, verification, and review, and drives
its own worktree-isolated build farm for code. Workers emit evidence; they never
mutate the backlog.

One item equals one branch and one worktree:

```text
git worktree add -b goals/<slug>/<id> CONTEXT/worktrees/<slug>/<id>
  -> contributor builds test-first and commits
  -> two independent per-item T0 reviewers
  -> merge to MAIN_BRANCH or report failure
```

The fixed contributor is `glm-5.2`. GLM may join research council
rounds but cannot review GLM-authored code.

**`goals` is the code review.** Two non-maker T0 reviewers apply the review
rubric to every item, and T1, T2, and T3 widen the same lenses. Running
a separate review skill afterwards re-reads work that has already been
reviewed.

## Worker Roles

The Goals Orchestrator may spawn named Worker Roles one level deep through the
host's native mechanism:

- `researcher` — settle ordinary research and fact lookups.
- `builder` — complete each code item or isolated verification command.
- `reviewer` — report item and milestone findings without editing them.
- `adversary` — report read-only T2/T3 findings.
- `small-task` — handle a bounded mechanical lookup or lane.

Workers never spawn. A `builder` commits only its item branch. Workers return
evidence and never write the backlog, lock, handoff, or push; the Orchestrator
alone owns those actions. Role names are host-neutral; do not use a host API,
path, or provider name as a Role identity. Use `council` only for a genuinely
contested fork, never for ordinary research, verification, or review.

## The review rubric

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
  handoff, `progress.md`, and review verdicts. Worker Roles and contributors
  report documentation impact only; they never edit a context artifact or the
  backlog.
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
runnable, and every configured Worker Role is dispatchable. Record the pre-goal
merge base. `MAX_BATCH` defaults to 3 and may never exceed 4.

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
3. Pin `MAIN_BRANCH`, `WORKTREE_ROOT`, pre-goal merge base, the Worker Role roster,
   and goal success criteria in both `goal.md` and `handoff.md`.
4. Present the milestone/ticket plan once for human approval. Do not build
   before approval.
5. Atomically write the backlog, create/match GitHub Milestones and issues when
   available, and mirror their initial state labels without creating
   duplicates.

## Phase B: backlog sanity

Spawn exactly two independent `reviewer` Worker Roles in one parallel dispatch.
Run one round only: no debate and no vote. Both apply `COVERAGE / DUPLICATES /
SCOPING / DEPENDENCIES / FEASIBILITY`. Apply findings mechanically; additive
evidence wins. Allow at most one rerun. Do not use `council` here: it is reserved
for a genuinely contested fork.

## Execution loop

Repeat until every item is `done` or `cancelled`:

1. Compute ready items whose dependencies are all `done`, preserving
   dependency order and the active milestone. Pass the handoff's explicit
   `milestone_cursor` to `state.mjs ready`; readiness must never cross a T1
   boundary.
2. Before spawning, flip the selected code ids to `in-progress` and atomically
   rewrite the backlog.
3. Send up to `MAX_BATCH` code items to the build farm as `builder` Worker Role
   lanes. Partial success is the default; one failed item must not sink green
   peers. Each builder commits only its item branch.
4. Spawn a `researcher` Worker Role for each ordinary `research` item and a
   `builder` Worker Role for each `verify` item. Do not run ordinary research or
   verification in the parent.
5. Ingest only `results.json` and `<id>.digest.json`, each kept to at most 30
   lines. Never ingest worker/reviewer transcripts; `.log` files are for
   humans.
6. Rewrite backlog and `handoff.md` atomically after every batch. A failed
   source id retains its attempt count; findings do not receive a fresh budget.
   Cap attempts at 2 per `source_id`, then escalate.

## Batch input

`MAX_BATCH` defaults to 3 and is capped at 4. Goals marks all selected ids
`in-progress` atomically before invoking the build farm. The CLI manifest is one
line per item:

```text
<id>|<branch>|<model>|<task prompt>
```

The task contains the plan/item path, exact acceptance criteria, locked
Verification-command, MAIN_BRANCH, and absolute worktree path. Set
`TEST_CMDS_JSON` to a complete JSON map from id to its locked command;
`TEST_CMD` is only accepted for a one-item batch. Reject any manifest model
other than the fixed contributor pin.

## CLI path

When `OPENCODE_BIN`, `~/.opencode/bin/opencode`, or `opencode` on `PATH` is
available, run:

```bash
delivery/goals/scripts/parallel.sh <repo-root> <worktree-root> <manifest>
```

The runner creates worktrees and launches one
`opencode run --dir <worktree> --model <model>` process per item concurrently.
CLI cannot directly select a `mode: subagent` agent, so each process uses the
built-in Build primary with an injected `task: deny` permission; reviewer
processes additionally receive `edit: deny`. It waits for committed worker
results, runs the locked command, then launches pinned reviewer models
concurrently per item in disposable detached review worktrees, so shell
activity cannot alter the contributor branch. Full output goes to `.log` files;
only result contracts return to goals.

## In-session fallback

If no OpenCode binary exists, goals creates every worktree, then sends one
tool message containing one `contributor` task call per item. Each worker is
told to operate only inside its absolute worktree, build test-first, run the
locked command, and commit.

After workers finish, goals sends one message containing two `reviewer` task
calls per item. Review each item independently. A conflict gets one dedicated
resolver call. Goals runs the locked command and passes its evidence to the
shell-disabled, edit-disabled reviewers. The fallback emits the same JSON
contract as the CLI path.

## T0 and merge rules

- Two reviewers per item, always. No verdict means no merge.
- Any evidenced P0/P1 blocks even if a reviewer mistakenly prints `PASS`.
- **Both reviewers apply the review rubric above** — the `over-build`, `slop`,
  and `structure` lenses, the named-replacement admissibility rule, and the
  `net: -<N>` close.
- `HARDENED=1` adds one read-only `adversary` T0 pass.
- Partial success is default: merge green/PASS peers and report failed ids.
- `STRICT_BATCH=1` integrates on a temporary branch and fast-forwards
  MAIN_BRANCH only when the whole batch succeeds, so a late failure cannot
  leave earlier peers merged.
- Goals alone integrates. Workers commit only their item branch; reviewers do
  not edit; no child updates the backlog or issue labels.

For overlap, begin a no-commit merge. Keep both unique non-overlapping hunks.
For the same hunk, prefer the incoming branch only inside its declared
`files_touched`; otherwise prefer HEAD. Remove markers and run `TEST_CMD`. If
still red, `git merge --abort`, mark that item failed, and continue the wave.
After a resolver edits the integration, materialize an immutable candidate
commit and rerun two independent T0 reviews in separate detached worktrees
before committing the same tree.

## Results contract

Every batch atomically writes:

```json
{"main_branch":"...","merged":[{"name":"...","branch":"...","sha":"...","verdict":"PASS"}],"blocked":[],"failed":[],"conflicts":[]}
```

Every item writes a compact one-line `<id>.digest.json`:

```json
{"id":"...","verdict":"PASS|FAIL","files_touched":[],"tests":{"pass":0,"fail":0,"cmd":"..."},"findings":[],"followups":[]}
```

Goals ingests only these files, never logs. `results.json`, digests, branch
ancestry, and Git are producer truth for Phase R.

## T1: milestone gate

After all milestone items finish, run cheap checks first: no new test failures
against baseline, build passes, no conflict/TODO/stub markers, and every
deliverable exists. Reject mechanically before spawning a reviewer.

Then spawn one read-only `reviewer` Worker Role for integration scope only:
composition, cross-item coverage gaps, and plan drift, under the `structure`
lens of the review rubric above. Item-level `over-build` and `slop` were
settled at T0 and are not re-litigated here. Do not reuse the same reviewer
consecutively when the host exposes that choice, and never use the maker's
implementation. Record `PASS`, `PASS-WITH-FOLLOWUPS`, or `FAIL` in
`reviews/M<n>.json` and `last_t1_reviewer` in the handoff.

After a passing T1, stop and show the milestone evidence. Wait for explicit
human continuation before starting the next milestone.

## T2 and T3

T2 reruns the final milestone mechanics against every plan success criterion
and spawns a `researcher` Worker Role for its facts sweep. A whole-deliverable
`adversary` pass is optional at T2.

T3 is mandatory after T2. Spawn one read-only `adversary` Worker Role on the
full cumulative MAIN_BRANCH diff from the pre-goal merge base, under all three
lenses of the review rubric above, closing with `net: -<N> lines possible.`
Require `reviews/T3.json` with `SHIP`, `SHIP-WITH-FOLLOWUPS`, or `BLOCK`. Drain
P0/P1 before completion; P2 may become labeled follow-up issues. A P0 `BLOCK`
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
