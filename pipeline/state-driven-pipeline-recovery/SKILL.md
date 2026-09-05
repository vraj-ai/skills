---
name: state-driven-pipeline-recovery
version: 1.0.0
description: Unstick a pipeline that is thrashing or reporting false progress — detect the false-green smells, classify the blockage as implementation defect vs missing structural prerequisite, and either repair with coder discipline or write a truthful blocker and spawn the prerequisite ticket. Use when a ticket has been retried repeatedly with no new evidence, when a worker reports success but nothing changed, when a ticket sits in Coding but cannot actually land, or when the tracker state and the repo disagree.
---

# state-driven-pipeline-recovery

When the pipeline is spinning, the failure is almost never "the agent needs to try harder." It is that **the state name is lying about reality**.

## Step 1 — Smell test for false progress

Any of these means stop and investigate rather than retry:

| Smell | What it actually means |
|---|---|
| Worker reports success, but no commit, no state change, no evidence comment | Nothing happened. The report is narrative. |
| Ticket is in Coding, but the production entry point bypasses the tested seam | The test proves nothing about the shipped path |
| The locked Verification-command references a harness that doesn't exist | The gate was never runnable; nobody ran it |
| A foundational protocol/prerequisite is missing, but the ticket pretends the feature lands on air | Structural blocker disguised as an implementation task |
| Repeated retries produce **identical** failure output | No new information is being generated — burn without learning |
| State says Done, but the gate is red on a fresh checkout | The state was moved without proof |

**Retrying an identical failure is not persistence. It is a loop with no exit condition.**

## Step 2 — Re-read reality, in this order

Do not touch code yet.

1. The ticket: current state, full body, **all comments** (bounces especially).
2. The plan doc it points at.
3. The **production entry point** — does real traffic actually reach the code under test?
4. The gate: run it. Right now. Record the real output.
5. `git log --oneline -10` and `git status -sb` — what actually landed?

Compare what the tracker claims against what the repo proves. Where they disagree, **the repo is right**.

## Step 3 — Classify

Exactly one of two:

**A. Implementation defect** — the design is sound, the code is wrong. The ticket *can* land as written.
→ Recover with `coder` discipline: lock the gate, reproduce, test-first, smallest fix, re-gate. Apply a repair budget (default five meaningful attempts), then escalate to B.

**B. Structural blocker** — the ticket *cannot* land as specified. A prerequisite doesn't exist, the seam is wrong, the plan assumed something false, or the invariant needs a boundary that isn't there.
→ **Do not keep burning the child.** Instead:
   1. Write a truthful blocker comment with the evidence.
   2. Spawn the prerequisite ticket (or bounce to the planner if the plan itself is wrong).
   3. Leave the blocked ticket's state **unchanged**.

Misclassifying B as A is the single most expensive mistake here — it burns budget forever on a ticket that was never landable.

## Step 4 — Recovery principles

1. **A scheduler tick is not implementation completion.** If anything auto-ran, its firing proves nothing about the work.
2. **State name `Coding` does not mean "unblocked child ready."** Check blockers yourself.
3. **Persistence and security tickets need real boundaries**, not in-memory fakes. A test against a stub proves the stub works.
4. **Structural blockers must be recorded.** Greenwashing or thrashing both destroy the evidence trail the next agent needs.
5. **Prefer the oldest unblocked child** over the shiny parent umbrella. Parents don't implement.
6. **Live provider spend and deploys remain separately authorized**, even during recovery.

## Step 5 — Write the recovery record

```
Recovery for <owner>/<repo>#<issue-number>
Observed: <the smell>
Evidence: <command + real output, verbatim>
Repo vs tracker: <where they disagreed>
Classification: implementation defect | structural blocker
Action taken: <repair / blocker comment / prerequisite GitHub issue #<number>>
State: <unchanged | moved X → Y, readback confirmed>
Next owner: <role>
```

## Anti-patterns

- Re-dispatching the same worker with the same prompt "but try harder."
- Moving a ticket to Done to unblock the queue.
- Deleting or rewriting failing tests to get green.
- Retrying past the budget without escalating classification.
- Treating a timeout as a total loss — assess what landed first (`subagent-delegation`).

## Related

`github-projects-pipeline` · `coder` · `debugger` · `subagent-delegation` · `invariant-evidence-review`
