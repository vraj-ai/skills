---
name: parallel-subagent-implementation
version: 1.1.0
description: Fan out work to several subagents at once on lanes you drew, with the parent holding every gate and performing all commits and tracker writes. Use when the user has explicitly authorized parallel or batch work, or when another skill needs the lane-and-gatekeeper protocol. Also routes to the right fan-out skill for plan tasks, dependency-ordered ticket ranges, and shared-tree mechanics.
---

# parallel-subagent-implementation

The default is **one thing at a time**. Fanning out is the authorized exception, and it relaxes no other rule.

## Route first — which fan-out is this?

Read the row that matches the work in front of you and go there. Coming back here for the lane-and-gatekeeper protocol is expected; every row below depends on it.

| The work | Skill |
|---|---|
| Independent **tickets**, disjoint lanes, all blockers met | **this skill** |
| An authorized ticket **range with a dependency graph** | `subagent-batch-implementation` (waves) |
| Tasks from a **written plan**, no tracker involved | `superpowers:subagent-driven-development` |
| Independent **investigations** — several unrelated failures, no code to land yet | `superpowers:dispatching-parallel-agents` |
| Workers sharing one checkout — briefs, timeouts, dirty trees | `shared-worktree-delegation` |
| Another agent or human is writing the same tree | `shared-worktree-safety` |

The plugin skills in that table cover **discovery and plan execution**; they do not know about tickets, gates, or the GitHub Project. When their output has to land as committed work on the board, the parent still runs Steps 1–6 below.

## Depth 1 — the parent fans out, workers never do

A **stage parent** is a separately launched top-level session. It may dispatch one level of workers. A worker may not dispatch anything: every brief must say so in words, because a worker that re-delegates puts a claim two hops from the evidence.

The parent owns the lanes, the gates, the commits, and the GitHub Project writes. Separate stage-parent sessions stay serial across the pipeline no matter how wide any one stage fans out.

## Preconditions — all must hold

- [ ] The user **explicitly authorized** parallel/batch work.
- [ ] Each ticket has its own **runnable Verification-command**.
- [ ] Lanes are **provably disjoint** — you have checked the files, not assumed.
- [ ] No ticket in the batch is **blocked by** another in the batch.
- [ ] A **baseline green** is recorded before dispatch.

Fail any precondition → do not fan out. Serialize instead, or go back to one ticket.

## Step 1 — Baseline

```powershell
git status -sb; git log --oneline -3
```

Run the project's broad verify **once** and record the result. This is your `BASELINE GREEN` and your `OUT OF SCOPE FAILURES` list. Without it, workers will chase pre-existing red tests.

## Step 2 — Draw lanes

For each ticket, list the files/dirs it owns. Then check for overlap **explicitly**:

- Overlapping lanes → serialize those tickets, or merge them into one.
- A shared interface/type file that several tickets need → **land that change first, alone, verified**, then fan out.
- At most **one** shared test file across the batch, and say so in every brief.

## Step 3 — Dispatch with full lane briefs

Every worker gets the complete brief (see `shared-worktree-delegation`):

```
TICKET: <owner>/<repo>#<issue-number>
GOAL: <one sentence>
YOUR LANE: <paths>
DO NOT EDIT: <sibling lanes, listed explicitly>
SHARED OK (≤1): <path or none>
NO COMMIT / PUSH / STAGE
GATE: `<exact command>`
BASELINE GREEN: <summary>
OUT OF SCOPE FAILURES: <list — do not fix>
KNOWN INVARIANTS: <from plan>
METHOD: test-first (red → green), smallest correct change
DO NOT DISPATCH SUBAGENTS — implement this lane yourself
RETURN: paths changed, gate output verbatim, invariants touched, blockers
```

Workers implement and verify. **Workers never commit, push, stage, or write to the tracker.** All external writes belong to the parent.

## Step 4 — Parent gate (the part that cannot be skipped)

Subagent summaries are **claims**. For each returned ticket, the parent independently:

1. `git status -sb` — confirm what actually landed.
2. Re-runs **that ticket's gate**.
3. Then, once for the whole batch: typecheck + broad suite.

Any ticket whose gate fails under the parent is **not done**, regardless of what its worker reported.

The gate is deterministic and cheap, so it runs first. Once it is green, a **reviewer that did not write the lane** is worth one more pass — `feature-dev:code-reviewer` for correctness findings, `code-simplifier` for the craft pass. Both read the diff without the worker's summary, which is the property that makes them useful. Their findings advise the parent; they never gate a commit, and they never move a Project item.

## Step 5 — Sequential external writes

Even though implementation was parallel, external writes are **serial and per-ticket**:

For each verified ticket, one at a time:
1. Stage only that ticket's paths.
2. Commit `type(scope): subject` + `Refs: #<issue-number>` (or
   `Refs: <owner>/<repo>#<issue-number>` across repositories).
3. Comment evidence on the GitHub issue (gate output verbatim, commit SHA).
4. Move that ticket Coding → Debugger Ready. **Re-read the state.**

Never one giant commit spanning the batch. It destroys per-ticket traceability and makes bounces unrevertable.

## Step 6 — Report honestly

Report per ticket: verified / failed parent gate / partial. **Never report a batch as "all green" from worker claims.** If 3 of 5 passed, that is the report.

## Failure handling

| Situation | Action |
|---|---|
| Worker times out | Assess on-disk state; finish by hand. Never blind re-dispatch. |
| Worker dispatched its own subagents | Discard its claims and re-run the gate yourself — the evidence is now two hops away. Fix the brief. |
| Two workers touched the same file | Stop the batch. Untangle manually. Record the lane error. |
| Parent gate fails for one ticket | That ticket stays in Coding with an honest comment. The others still ship. |
| Broad suite red after merge | Bisect by ticket. Do not commit anything until you know which lane broke it. |

## Related

`shared-worktree-delegation` · `shared-worktree-safety` · `subagent-batch-implementation` · `delivery-constraints` · `coder` · `superpowers:subagent-driven-development` · `superpowers:dispatching-parallel-agents`
