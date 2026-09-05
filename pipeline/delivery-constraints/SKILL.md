---
name: delivery-constraints
version: 1.0.0
description: Deliver a ticket whose delivery path is decided by something other than the code — a token/spend cap, a live data migration, restricted git authority, an unwritable tracker, or a pipeline state that is lying about progress. Use when budget is capped, when a change touches production data or costs money to run, when push/PR authority is restricted, when tracker writes are unavailable and work must hand off through a file, or when a ticket has been retried with no new evidence and the tracker and the repo disagree.
recommended: false
---

# Delivery constraints

Normal ticket work assumes a normal environment: full authority, a writable tracker, an honest state machine, and budget to spare. This skill is for when one of those assumptions is false — when the constraint, not the code, decides how the work ships or whether it can ship at all.

A missing authority and a lying pipeline state are the same class of problem: an external fact that invalidates the obvious path. Both are handled by naming the fact first, then choosing a path that respects it.

## Step 1 — Name the constraints explicitly

Write them down before starting. An unnamed constraint gets violated.

| Constraint | Questions to answer now |
|---|---|
| **Budget** | Token/spend cap? What is already burned? What happens at the cap — stop, or degrade? |
| **Spend authority** | Does this run call paid providers, deploy, or purchase? Spend is **always separately authorized.** |
| **Migration** | Does this touch live data? Is it reversible? Is there a backup? Is expand-then-contract available? |
| **Git authority** | Commit allowed? Push allowed? Direct to branch, or PR only? Protected branches? |
| **Tracker access** | Can you write the tracker at all — the right scope, the right board, the right field? If not, where does the handoff live? |
| **Time** | Hard deadline that changes the acceptable path? |
| **State trust** | Does the tracker's claim about this ticket match what the repo proves? (Step 2.) |

State the resolved set back in one block before implementing.

## Step 2 — Check the state is not lying

The cheapest constraint to miss is a false green. Any of these means stop and investigate rather than retry:

| Smell | What it actually means |
|---|---|
| A worker reports success, but there is no commit, no state change, no evidence | Nothing happened. The report is narrative. |
| The ticket is in an implementing state, but the production entry point bypasses the tested seam | The test proves nothing about the shipped path |
| The locked verification command references a harness that does not exist | The gate was never runnable; nobody ran it |
| A foundational prerequisite is missing, but the ticket pretends the feature lands on air | Structural blocker disguised as an implementation task |
| Repeated retries produce **identical** failure output | No new information is being generated — burn without learning |
| State says done, but the gate is red on a fresh checkout | The state was moved without proof |

**Retrying an identical failure is not persistence. It is a loop with no exit condition.**

When a smell fires, re-read reality before touching code, in this order:

1. The ticket — current state, full body, **all comments**, bounces especially.
2. The plan or spec it points at.
3. The **production entry point** — does real traffic reach the code under test?
4. The gate: run it, right now, and record the real output.
5. `git log --oneline -10` and `git status -sb` — what actually landed?

Where the tracker and the repo disagree, **the repo is right**.

## Step 3 — Classify the blockage

If Step 2 fired, the ticket is exactly one of two things:

**A. Implementation defect** — the design is sound, the code is wrong, the ticket *can* land as written.
→ Repair with normal implementation discipline: lock the gate, reproduce, test first, smallest fix, re-gate. Apply the repair budget from Step 4, then escalate to B.

**B. Missing structural prerequisite** — the ticket *cannot* land as specified. A prerequisite does not exist, the seam is wrong, the plan assumed something false, or an invariant needs a boundary that is not there.
→ **Do not keep burning the ticket.** Instead:
   1. Record a truthful blocker with the evidence.
   2. Spawn the prerequisite ticket, or bounce to whoever owns the plan if the plan itself is wrong.
   3. Leave the blocked ticket's state **unchanged**.

Misclassifying B as A is the single most expensive mistake here — it burns budget forever on a ticket that was never landable.

## Step 4 — Choose the delivery path

| Situation | Path |
|---|---|
| Full authority, honest state, normal ticket | Standard implementation flow |
| No push authority | Implement and commit locally, write the handoff, report. **Do not push.** |
| No commit authority | Implement, verify, leave the tree dirty, write a handoff describing exactly what to stage |
| No tracker write | **Local handoff file** (Step 7). Never substitute a label or an issue closure for a missing state write. |
| Live data migration | Expand → backfill → verify → contract, as **separate** tickets. Never one commit. |
| Tight budget | Narrow the gate to the smallest command that still proves the ticket; broad verify once at the end |
| Structural blocker (Step 3B) | Blocker record plus prerequisite ticket. No code. |

## Step 5 — Budget discipline

- Lock the **narrowest gate that still proves the acceptance criteria** — a focused test file, not the whole suite, for the repair loop.
- Run the broad verify **once**, at the end.
- Set a repair budget, default **five meaningful attempts**. "Meaningful" means new information each time; identical failures do not count and instead send you back to Step 2.
- When the cap is reached: **stop and report honestly.** Do not degrade into guess-patching to look productive.
- A scheduler tick, a retry, or an automation firing proves nothing about the work. Only evidence does.
- Spend, deploy, and purchase stay separately authorized even during recovery.
- Prefer the oldest unblocked child ticket over the umbrella parent. Parents do not implement.

## Step 6 — Migration safety

Never combine schema change, backfill, and cutover in one ticket.

```
Ticket A: expand   — add the new shape, both paths work, nothing reads it yet
Ticket B: backfill — populate, with a verifiable count/checksum gate
Ticket C: cutover  — reads switch over, old path still present
Ticket D: contract — remove the old shape
```

Each stage gets its own gate and its own reversibility statement. A migration ticket whose verification command does not prove data integrity is not ready. Persistence and security work needs real boundaries — a test against a stub only proves the stub works.

## Step 7 — Write the record

When the tracker is unwritable, hand off through a file in the repository being worked on:

```markdown
# Handoff <owner>/<repo>#<issue-number>
- role_that_ran:
- state_intended_next:
- paths:
- verify_command:
- verify_output: |
    <verbatim>
- commit:
- pushed: no (no authority this run)
- invariants:
- followups:
- blockers:
- tracker_readback: <item URL/JSON, or blocker evidence>
```

When Step 2 fired, record the recovery alongside it:

```
Recovery for <owner>/<repo>#<issue-number>
Observed: <the smell>
Evidence: <command + real output, verbatim>
Repo vs tracker: <where they disagreed>
Classification: implementation defect | missing prerequisite
Action taken: <repair / blocker record / prerequisite ticket #<number>>
State: <unchanged | moved X → Y, readback confirmed>
Next owner: <role>
```

Both records live inside the repository under change. Say clearly in the report that the tracker was **not** updated and who must update it.

## Non-negotiables

- Constraints are named before code is written.
- Spend, deploy, and purchase are separate authority — always.
- Migrations are staged and reversible.
- No claim of commit, push, or tracker success without proof.
- Budget exhaustion is reported, never hidden behind a plausible-looking diff.
- Structural blockers are recorded; greenwashing and thrashing both destroy the evidence trail the next agent needs.

## Anti-patterns

- Re-dispatching the same worker with the same prompt "but try harder."
- Moving a ticket to done to unblock the queue.
- Deleting or rewriting failing tests to get green.
- Retrying past the budget without re-classifying.
- Treating a timeout as a total loss — assess what landed first.

## Related

`push-handoff` · `implementation-tdd` · `subagent-delegation` · `audit`
