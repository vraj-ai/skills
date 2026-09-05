---
name: subagent-delegation
version: 1.0.0
description: Fan work out to subagents safely — draw provably disjoint lanes, write the full lane brief, order dependent tickets into waves, and keep the parent as the sole gatekeeper that re-runs every gate and performs every commit and tracker write. Use when parallel or batch work is explicitly authorized, when an authorized ticket range has a dependency graph, when workers share one git checkout, or when any agent or human may be writing the same tree concurrently.
recommended: false
---

# subagent-delegation

The default is **one thing at a time**. Fanning out is the authorized exception, and it relaxes no other rule.

Most multi-agent disasters are not reasoning failures. They are **two writers in one checkout**, or a parent that accepted a summary as evidence. Everything below exists to prevent one of those two.

## Pick the mode

| The work | Read |
|---|---|
| Independent tickets, disjoint lanes, all blockers met | Flat fan-out — Steps 1–6 |
| An authorized ticket **range with a dependency graph** | Wave mode, after Steps 1–6 |
| Workers sharing one checkout | Shared tree or isolated worktrees + Steps 1–6 |
| Another agent or human writes the same tree | Shared-tree invariants |
| Tasks from a written plan, no tracker involved | `superpowers:subagent-driven-development`, then Steps 4–6 here to land it |
| Independent investigations, no code to land yet | `superpowers:dispatching-parallel-agents` |

Plugin skills cover discovery and plan execution; they do not know about tickets, gates, or a tracker. When their output has to land as committed work, the parent still runs Steps 1–6.

## Depth 1 — the parent fans out, workers never do

A **stage parent** is a separately launched top-level session running one stage. It may dispatch one level of workers when its harness supports a subagent mechanism. A worker may dispatch nothing: every brief must say so in words, because a worker that re-delegates returns a summary of a summary and puts the evidence two hops from the parent that has to verify it.

A native child launched from another session is not a stage parent. Stage-parent sessions stay serial across the pipeline no matter how wide any one stage fans out. Tracker items, issue and PR artifacts, and handoffs are what bridge independent stage-parent sessions.

The parent — coordinator or stage parent — owns the lanes, the gates, the commits, and every tracker write.

## Shared tree or isolated worktrees?

| Use a shared tree | Use isolated worktrees |
|---|---|
| Lanes are cleanly separable by directory/file | Agents must edit the same files |
| Work is small and fast | Long refactors that churn shared modules |
| You need one coherent tree at the end | You'll merge/cherry-pick results deliberately |

Isolated worktrees cost real setup time and disk. They are the right answer when lanes cannot be drawn — not a way to avoid drawing them. If the workspace manages worktrees on the human's behalf, ask before creating one. `superpowers:using-git-worktrees` covers the isolation branch end to end once you've decided that's the answer.

Delegating into a *shared* checkout is safe **only** with lanes and a gatekeeper parent. Without both, workers overwrite each other and then report partial greens the parent has no way to distinguish from real ones.

## Preconditions — all must hold

- [ ] The user **explicitly authorized** parallel/batch work.
- [ ] Each ticket has its own **runnable Verification-command**.
- [ ] Lanes are **provably disjoint** — you have checked the files, not assumed.
- [ ] No ticket in the batch is **blocked by** another in the same wave.
- [ ] A **baseline green** is recorded before dispatch.

Fail any precondition → do not fan out. Serialize instead, or go back to one ticket.

## Step 1 — Baseline

```
git rev-parse --abbrev-ref HEAD
git status -sb
git log --oneline -5
```

Run the project's broad verify **once** and record the result. This is your `BASELINE GREEN` and your `OUT OF SCOPE FAILURES` list. Without it, workers chase pre-existing red tests. Record the ticket's current tracker state and latest comments too.

**List explicitly which dirty paths are NOT yours.** That list is a contract with yourself, and it is the input to the shared-tree invariants below.

## Step 2 — Draw lanes

For each ticket, list the files/dirs it owns. Then check for overlap **explicitly**:

- Overlapping lanes → serialize those tickets, or merge them into one.
- A shared interface/type file several tickets need → **land that change first, alone, verified**, then fan out.
- At most **one** shared test file across the batch, and say so in every brief.
- Workers whose lanes touch the same module run **in series**, not parallel.

Wave size and batch width are bounded by lane separability, not by ambition.

## Step 3 — Dispatch with the full lane brief

Every concurrent worker's brief **must** contain all of these lines:

```
TICKET: <owner>/<repo>#<issue-number>
GOAL: <one sentence>
YOUR LANE: <files / dirs you may edit>
DO NOT EDIT: <sibling-owned paths, explicitly listed>
SHARED OK (<=1): <optional single shared test file, if unavoidable>
NO COMMIT / PUSH / STAGE (unless the parent explicitly ordered otherwise)
NO SUBAGENTS — implement this lane yourself
GATE: `<exact command>`
BASELINE GREEN: <current suite summary — what already passes>
OUT OF SCOPE FAILURES: <known-red items — do NOT "fix" these>
KNOWN INVARIANTS: <from the plan>
METHOD: test-first (red → green), smallest correct change
RETURN: paths changed, gate output verbatim, invariants touched, blockers
```

Why each line exists:

- **YOUR LANE / DO NOT EDIT** — without both, workers infer scope from the task text and overlap.
- **SHARED OK (≤1)** — one shared file is survivable; two is a merge conflict machine.
- **NO COMMIT/PUSH/STAGE** — subagents committing concurrently into one tree interleave unrelated work into each other's commits. The parent commits.
- **NO SUBAGENTS** — a re-delegating worker leaves the parent's gate as the only thing holding truth.
- **BASELINE GREEN + OUT OF SCOPE FAILURES** — without these, a worker sees an unrelated red test, "helpfully" fixes it, and blows its lane.
- **GATE** — the worker's done-condition must be machine-checkable, same as any ticket.

Workers implement and verify. **Workers never commit, push, stage, or write to the tracker.** All external writes belong to the parent.

## Step 4 — Parent gate (the part that cannot be skipped)

**A subagent summary is a claim.** It is not evidence, no matter how confident or detailed. For each returned ticket the parent independently:

1. Runs `git status -sb` — confirm what actually landed on disk.
2. Re-runs **that ticket's own gate**.
3. Runs a **proportional project verify** — typecheck plus the broad suite — once for the whole batch or wave.

Any ticket whose gate fails under the parent is **not done**, regardless of what its worker reported. Skip this and "3 of 3 agents reported success" coexists happily with a broken tree.

The gate is deterministic and cheap, so it runs first. Once it is green, a **reviewer that did not write the lane** is worth one more pass — `feature-dev:code-reviewer` for correctness findings, `code-simplifier` for the craft pass. Both read the diff without the worker's summary, which is the property that makes them useful. Their findings advise the parent; they never gate a commit and never move a tracker item.

## Step 5 — Sequential external writes

Even though implementation was parallel, external writes are **serial and per-ticket**. Before each one, re-check ownership (see invariant 5). Then, one ticket at a time:

1. Stage only that ticket's paths — explicit paths, never `-A`, never `.`, never `commit -a`.
2. Commit `type(scope): subject` + `Refs: #<issue-number>` (or `Refs: <owner>/<repo>#<issue-number>` across repositories).
3. Comment evidence on the issue — gate output verbatim, commit SHA.
4. Move that ticket to its next state. **Re-read the state to confirm the move.**

Never one giant commit spanning the batch or the wave. One commit per ticket, one tracker move per ticket. A batch-wide commit destroys per-ticket traceability and makes bounces unrevertable.

## Step 6 — Report honestly

Report per ticket: verified / failed parent gate / partial. **Never report a batch as "all green" from worker claims.** If 3 of 5 passed, that is the report.

## Wave mode — an authorized range with a dependency graph

Flat fan-out assumes independence. When the range has real `Blocked-by` edges, deliver it in waves instead.

### Authority and scope

Restate the authorization back to the user before starting:

> Batch authorized: `<owner>/<repo>#201..#208`. Commit: yes. Push: `<yes/no>`. I will stop the batch on the first wave that fails its parent gate.

If push authority is unclear, assume **no push** and hand off instead.

### Build the wave plan

Read every ticket in the range, extract `Blocked-by`, and print the plan **before implementing**:

```
Wave 1: #201 (domain service), #202 (API authz)   [disjoint lanes]
Wave 2: #203 (mobile surface)                     [blocked by 201, 202]
Wave 3: #204..206                                 [blocked by 203]
```

- A ticket never enters a wave before its blockers are **Done** — not "probably fine".
- Within a wave, lanes must be disjoint. Otherwise split the wave.

### Execute one wave at a time

Baseline once, before Wave 1, and carry `BASELINE GREEN` and `OUT OF SCOPE FAILURES` into every wave brief unchanged. Then per wave: dispatch (Step 3) → parent gate each ticket (Step 4) → wave verify → serial per-ticket external writes (Step 5) → only then start the next wave.

**A wave is a barrier.** Starting Wave 2 before Wave 1 is verified is how batches produce piles of half-work nobody can bisect.

### Halt conditions

Stop the whole batch and report when any of these occur:

- A ticket fails the parent gate past its repair budget (default: five meaningful attempts).
- The broad suite goes red and you cannot attribute it to one ticket.
- A ticket's real blockers turn out to differ from its `Blocked-by` field.
- A structural prerequisite is missing — a ticket cannot land as specified.
- Tracker authentication expires.

Halting is a **successful outcome** for the tickets already verified. Report exactly which shipped, which is blocked, and why. Do not thrash the remainder to preserve appearances.

### Batch report

```
Batch <owner>/<repo>#201..#208
Wave 1: #201 PASS <sha>   #202 PASS <sha>
Wave 2: #203 PASS <sha>
Wave 3: #204 BLOCKED — <reason + evidence>
        #205, #206 not started (blocked by #204)
Broad verify after last committed wave: <command> -> <result>
States moved: 201,202,203 (readback confirmed)
```

## Shared-tree invariants

These hold whenever anyone else — a worker, a background task, or a human — may write the checkout you are in.

**1. Capture a baseline before touching anything.** Step 1 above. Everything later is judged against it.

**2. Preserve dirty paths you do not own.** Files dirty at baseline that your ticket doesn't own are sacred: don't stage them, don't revert them, don't "clean up" them, don't stash them. A stash is a silent theft from whoever was mid-edit. If your change genuinely requires touching one, **stop and report the collision** rather than resolving it unilaterally.

**3. Mid-run file changes are a concurrency signal.** A file that changed since you read it means someone else is working. Do not apply your edit over a stale read: detect change → re-read the file → re-evaluate whether your edit still applies. If it no longer makes sense against the new content, that's a collision. Report it.

**4. Stage narrowly, always.** `git add <explicit paths>`, never `git add -A`, never `git add .`, never `git commit -a`. In a shared tree, `-A` commits someone else's half-finished work under your ticket number.

**5. Re-check ownership before every external write.** External writes are commit, push, tracker comment, tracker state move, PR, deploy. Immediately before each one — not once at the start of the run — verify the world hasn't moved: is the ticket still in the state you think, did someone else already commit this work, is the branch still what you started on? These are the writes you cannot undo cheaply.

**6. If someone else already finished it — verify, do not duplicate.** Discovering the work is already done is a success, not a race to redo it. Run the gate yourself. If it passes, comment your independent confirmation and **do not repeat the external writes** — no duplicate state moves, no duplicate commits. If it fails, that's a finding: report it, don't quietly rewrite over them.

## Timeout ≠ lost work

When a worker or long task times out, most of its edits are usually already on disk. Assess before reacting:

```
git status -sb
git diff --stat
```

Then typecheck and run the gate. Finish the remainder **by hand** and record what you found. **Never blind re-dispatch the same task into a dirty half-refactor** — that produces duplicated code, conflicting edits, and a tree nobody can reason about.

## Red flags

| Signal | Meaning |
|---|---|
| File mtime changed since your read | Another writer is active |
| `git status` grew paths you didn't touch | Concurrent agent or human |
| Your commit contains files you don't recognize | You staged too broadly — reset and redo |
| Ticket state changed under you | Someone else claimed it |
| Gate passes but your change isn't in HEAD | You committed the wrong tree |

## Failure handling

| Situation | Action |
|---|---|
| Worker times out | Assess on-disk state; finish by hand. Never blind re-dispatch. |
| Worker dispatched its own subagents | Discard its claims and re-run the gate yourself — the evidence is now two hops away. Fix the brief. |
| Two workers touched the same file | Stop the batch. Untangle manually. Record the lane error. |
| Parent gate fails for one ticket | That ticket stays where it is with an honest comment. The others still ship. |
| Broad suite red after merge | Bisect by ticket. Commit nothing until you know which lane broke it. |

## Verification

```
- [ ] Every worker brief contains all lane-brief lines
- [ ] Lanes are provably disjoint (or overlapping workers serialized)
- [ ] No subagent committed, pushed, staged, or dispatched a subagent of its own
- [ ] Parent re-ran every worker's gate itself
- [ ] Parent ran a proportional project verify before any external write
- [ ] Baseline captured and out-of-scope dirty paths listed
- [ ] No unrelated file staged, reverted, or stashed
- [ ] Files re-read after any detected mid-run change
- [ ] Ownership re-checked immediately before each external write
- [ ] One commit and one tracker move per ticket, each read back
- [ ] Out-of-scope failures listed up front and still out of scope afterward
- [ ] Post-timeout: assessed on-disk state before any re-dispatch
```

## Related

`controlled-ticket-delivery` · `state-driven-pipeline-recovery` · `ticket-implementation-tdd` · `invariant-evidence-review` · `superpowers:using-git-worktrees` · `superpowers:subagent-driven-development` · `superpowers:dispatching-parallel-agents`
