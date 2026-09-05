---
name: controlled-ticket-delivery
version: 1.0.0
description: Deliver a ticket under explicit external constraints — token/spend budget, a live data migration, restricted git authority, or limited tracker access — by naming every constraint up front and choosing a delivery path that respects them. Use when budget is capped, when a change touches production data or costs money to run, when push/PR authority is restricted, or when tracker writes are unavailable and work must hand off through a file instead.
---

# controlled-ticket-delivery

`coder` assumes a normal environment. This skill is for when it isn't — when the constraint, not the code, decides how the work ships.

## Step 1 — Name the constraints explicitly

Write them down before starting. An unnamed constraint gets violated.

| Constraint | Questions to answer now |
|---|---|
| **Budget** | Token/spend cap? What's already burned? What happens at the cap — stop, or degrade? |
| **Spend authority** | Does this run call paid providers, deploy, or purchase? Spend is **always separately authorized.** |
| **Migration** | Does this touch live data? Is it reversible? Is there a backup? Expand-then-contract available? |
| **Git authority** | Commit allowed? Push allowed? Direct to branch, or PR only? Protected branches? |
| **Tracker access** | Can you write the GitHub Project? Does `gh auth` have the `project` scope? If not, where does the handoff live? |
| **Time** | Hard deadline that changes the acceptable path? |

State the resolved set back to the user in one block before implementing.

## Step 2 — Choose the delivery path

| Situation | Path |
|---|---|
| Full authority, normal ticket | Standard `coder` |
| No push authority | Implement + commit locally, write handoff, report. **Do not push.** |
| No commit authority | Implement, verify, leave the tree dirty, write a handoff describing exactly what to stage |
| No project write | **Local handoff file** (template below). Never substitute labels or issue closure for a missing Project `Status` write. |
| Live data migration | Expand → backfill → verify → contract, as **separate** tickets. Never one commit. |
| Tight budget | Narrow the gate to the smallest command that still proves the ticket; broad verify once at the end |

## Step 3 — Budget discipline

- Lock the **narrowest gate that still proves the acceptance criteria** — a focused test file, not the whole suite, for the repair loop.
- Run the broad verify **once**, at the end.
- Set a repair budget (default **five meaningful attempts**). "Meaningful" = new information each time. Identical failures don't count; they signal a structural problem — go to `state-driven-pipeline-recovery`.
- When the cap is reached: **stop and report honestly**. Do not degrade into guess-patching to look productive.

## Step 4 — Migration safety

Never combine schema change, backfill, and cutover in one ticket.

```
Ticket A: expand   — add the new shape, both paths work, nothing reads it yet
Ticket B: backfill — populate, with a verifiable count/checksum gate
Ticket C: cutover  — reads switch over, old path still present
Ticket D: contract — remove the old shape
```

Each stage gets its own gate and its own reversibility statement. A migration ticket whose Verification-command doesn't prove data integrity is not ready.

## Step 5 — Local handoff (when the tracker is unwritable)

```markdown
# Handoff <owner>/<repo>#<issue-number>
- role_that_ran: coder | planner | debugger
- state_intended_next: Debugger Ready
- paths:
- verify_command:
- verify_output: |
    <verbatim>
- commit:
- pushed: no (no authority this run)
- invariants:
- followups:
- blockers:
- github_project_readback: <project item URL/JSON or blocker evidence>
```

Write it to the project's handoff location. Say clearly in your report that the tracker was **not** updated and who must update it.

## Non-negotiables

- Constraints are named before code is written.
- **Spend, deploy, and purchase are separate authority** — always.
- Migrations are staged and reversible.
- No claim of commit/push/tracker success without proof.
- Budget exhaustion is reported, never hidden behind a plausible-looking diff.

## Related

`coder` · `push-handoff` · `state-driven-pipeline-recovery` · `github-projects-pipeline` · `implementation-tdd`
