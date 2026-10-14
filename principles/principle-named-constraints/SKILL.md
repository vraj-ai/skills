---
name: principle-named-constraints
version: 1.0.0
description: List and name every delivery constraint — budget, spend authority, git authority, tracker access, time, state trust — before starting work, because an unnamed constraint gets violated and a named one chooses the path. Apply before executing any task whose environment may restrict the obvious path.
recommended: false
---

# Principle: named constraints

Normal work assumes a normal environment: full authority, a writable tracker,
an honest state machine, budget to spare. When any of those is false, the
constraint — not the code — decides how the work ships or whether it ships at
all.

An unnamed constraint gets violated. A missing authority and a lying pipeline
state are the same class of problem: an external fact that invalidates the
obvious path. Both are handled by naming the fact first, then choosing a path
that respects it.

## The constraint table

| Constraint | Question to answer before starting |
|---|---|
| Budget | Token/spend cap? Already burned? What happens at the cap — stop or degrade? |
| Spend authority | Does this call paid providers, deploy, or purchase? Spend is always separately authorized. |
| Live data | Does it touch production data? Reversible? Backup? Expand-then-contract available? |
| Git authority | Commit allowed? Push? Direct to branch or PR only? Protected branches? |
| Tracker access | Can you write the right scope, board, field? If not, where does the handoff live? |
| Time | Hard deadline that changes the acceptable path? |
| State trust | Does the tracker's claim match what the repo proves? See principle-evidence-over-report. |

State the resolved set back in one block before implementing. Where a
constraint invalidates the obvious path, the task reports the constraint and
the chosen path — it does not silently take a narrower one or pretend the
blocked one ran.
