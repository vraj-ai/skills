---
name: subagent-batch-implementation
version: 1.1.0
description: Deliver an explicitly authorized RANGE of tickets in sequential waves, where each wave respects blocker ordering, the parent verifies every wave before starting the next, and a red wave halts the batch. Use when the user authorizes a GitHub issue range such as "do #201 through #208", when a plan's children must land in dependency order, or when a batch is too large or too coupled for a single parallel fan-out.
---

# subagent-batch-implementation

For an **authorized ticket range** where dependencies matter. Flat fan-out
(`parallel-subagent-implementation`) assumes independence; this skill assumes a
**dependency graph** and delivers it in waves. Its route table decides between the
two — come here only once you know the graph is real.

A stage parent is a separately launched top-level session. Stage-parent sessions run
serially across the GitHub Project; only workers inside an explicitly authorized
stage fan out, one level deep. A worker dispatches nothing of its own — every brief
says so — and the parent holds every gate and external write.

## Step 0 — Authority and scope

Restate the authorization back to the user before starting:

> Batch authorized: <owner>/<repo>#201..#208. Commit: yes. Push: <yes/no>. I will stop the batch on the first wave that fails its parent gate.

If push authority is unclear, assume **no push** and hand off instead.

## Step 1 — Build the wave plan

Read every ticket in the range. Extract `Blocked-by`. Then group into waves:

```
Wave 1: tickets with no unmet blockers
Wave 2: tickets unblocked once Wave 1 is Done
Wave 3: ...
```

Print the wave plan **before implementing**:

```
Wave 1: #201 (domain service), #202 (API authz)   [disjoint lanes]
Wave 2: #203 (mobile surface)                     [blocked by 201, 202]
Wave 3: #204..206                                 [blocked by 203]
```

Rules:
- A ticket never enters a wave before its blockers are **Done** (not "probably fine").
- Within a wave, lanes must be disjoint — otherwise split the wave.
- Wave size is bounded by lane separability, not by ambition.

## Step 2 — Baseline once

Broad verify before Wave 1. Record `BASELINE GREEN` and `OUT OF SCOPE FAILURES`. Carry them into every wave brief unchanged.

## Step 3 — Execute one wave at a time

For each wave:

1. **Dispatch** workers with full lane briefs (see `shared-worktree-delegation`). No worker commits, pushes, stages, writes the tracker, or dispatches a subagent.
2. **Parent gate** — re-run each ticket's own gate yourself. Worker claims are not evidence.
3. **Wave verify** — typecheck + broad suite once for the wave.
4. **External writes, serially, per ticket** — stage narrowly, commit with `Refs:`, comment evidence with verbatim gate output and SHA, move Coding to Debugger Ready, then **re-read state**.
5. **Only then** start the next wave.

**A wave is a barrier.** Starting Wave 2 before Wave 1 is verified is how batches produce piles of half-work that nobody can bisect.

## Step 4 — Halt conditions

Stop the whole batch and report when any of these occur:

- A ticket fails the parent gate past its repair budget (default: five meaningful attempts).
- The broad suite goes red and you cannot attribute it to one ticket.
- A ticket's real blockers turn out to differ from its `Blocked-by` field.
- A structural prerequisite is missing — a ticket cannot land as specified.
- Tracker auth expires.

Halting is a **successful outcome** for the tickets already verified. Report exactly which shipped, which is blocked, and why. Do not thrash the remainder to preserve appearances.

## Step 5 — Batch report

```
Batch <owner>/<repo>#201..#208
Wave 1: #201 PASS <sha>   #202 PASS <sha>
Wave 2: #203 PASS <sha>
Wave 3: #204 BLOCKED — <reason + evidence>
        #205, #206 not started (blocked by #204)
Broad verify after last committed wave: <command> -> <result>
States moved: 201,202,203 -> Debugger Ready (readback confirmed)
```

## Non-negotiables

- Blocker order is real. Never start a ticket whose blocker isn't Done.
- One commit per ticket. Never one commit per wave.
- Parent re-runs every gate.
- Re-read state after every move.
- Project item and issue writes are performed only by the parent, serially, with
  readback after each mutation.

## Related

`parallel-subagent-implementation` (route table) · `shared-worktree-delegation` · `delivery-constraints`
