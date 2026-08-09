---
name: profile-gated-delivery
version: 1.1.0
description: Run the preserved legacy planner, coder, debugger, and reviewer effort across separate stage-parent sessions with an evidence gate between every stage. Use only when deliberately coordinating the legacy four-stage workflow rather than the active goals pipeline.
---

# profile-gated-delivery

The preserved factory in one skill: **legacy-planner → legacy-coder → legacy-debugger → legacy-reviewer**, with an evidence gate between each stage.

The point is not the stages. It is that **each stage's entry condition is the previous stage's proof** — and that the maker of a change is never its reviewer.

## Stage-parent sessions

GPT-5.6 Luna is the overall coordinator. It may dispatch Opus 5 in Claude Code
for planning after the human decisions are known. Kimi, Codex, and Grok are
independent top-level parent sessions for the remaining stages:

| Stage | Parent / harness | Effort |
|---|---|---|
| **planner** | Opus 5 / Claude Code subscription, Luna-dispatched or visible | medium/high |
| **coder** | Kimi K3 / Pi via OpenRouter; optional Kimi K2.7 Code helpers | high |
| **debugger** | GPT-5.6 Luna / Codex subscription | **max** |
| **reviewer** | Grok 4.5 / Pi via OpenRouter | high/xhigh |

A stage parent may coordinate one level of helpers when its own harness supports it.
A native child launched from another session cannot spawn nested children. The
GitHub Project item, GitHub issues/PRs, and handoffs are the bridge between
stage-parent sessions. Keep
stages serial and one ticket in flight.

## The four roles

| Role | Queue | Loads | Produces | State effect |
|---|---|---|---|---|
| **planner** | Planned | `github-projects-pipeline` → `legacy-planner` | plan doc and ready tickets | Planned → Agent Ready when blockers are done |
| **coder** | Agent Ready | `github-projects-pipeline` → `legacy-coder` | code, tests, commit, evidence | Coding → Debugger Ready |
| **debugger** | Debugger Ready | `github-projects-pipeline` → `legacy-debugger` | hardened diff, evidence, follow-ups | Debugging → Review Ready |
| **reviewer** | Review Ready | `github-projects-pipeline` → `legacy-reviewer` | blind verdict and routing | Reviewing → Done or bounce |

The human owns two things no agent may take: **creating the effort in Planned** and **canceling**. The planner promotes a child from Planned → Agent Ready only when its blockers are Done. Spend, deploy, and purchase are separately authorized at any stage.

## The gates

Between every stage there is an artifact that must **exist and be checkable** before the next stage may start.

**Gate 1 — authorized effort.** The human creates or approves the effort in Planned. Nothing is planned that the human has not decided deserves the burn.

**Gate 2 — plan is real.** Before any coder starts:
- [ ] Plan doc exists at `plans/<id>/PLAN.md`
- [ ] Invariants are measurable (numbers, not adjectives)
- [ ] Every child has a **runnable** Verification-command
- [ ] Every child has a priority and Blocked-by edges
- [ ] Unblocked children are in Agent Ready; blocked children remain Planned, with readback confirmed

A child without a runnable gate does not enter the coder queue. Send it back to planning.

**Gate 3 — implementation is proven.** Before any debugger starts:
- [ ] Exactly one ticket was worked
- [ ] The locked gate was re-run **after the final edit**, output verbatim
- [ ] Commit carries `Refs: <id>`
- [ ] Unrelated dirty files untouched
- [ ] Ticket moved Coding → Debugger Ready, **readback confirmed**

**Gate 4 — hardening is proven.** Before reviewing:
- [ ] The debugger re-ran the gate **itself**
- [ ] Broader verify proportional to the change
- [ ] Four nets and the named corners were swept (`legacy-debugger`)
- [ ] Ticket moved Debugging → Review Ready, **readback confirmed**

**Gate 5 — independent acceptance.** Before a ticket is Done:
- [ ] The reviewer re-ran the gate itself
- [ ] The reviewer used a fresh model/context and did not read maker handoffs before judging
- [ ] Verdict is PASS or a classified bounce
- [ ] Only the reviewer moves Reviewing → Done

## Maker ≠ checker

Whenever tooling allows, the author and the reviewer are **different contexts**:

- Different subagent / session, given only the ticket, the diff, and the gate — **not the maker's self-story**.
- The maker's summary is a claim. The checker's re-run is evidence.

A single agent "reviewing itself in the same breath" is a weak fallback, not the design. If you must do it, say so explicitly in the handoff and treat the result as lower-confidence.

## Running it

For each unit of work, in order:

1. Confirm the GitHub Project identity (`github-projects-pipeline` step 0).
2. Confirm Gate 1. If the effort is not authorized, **stop and ask** — do not self-promote.
3. Planner run → check Gate 2.
4. Coder run on the **oldest unblocked** Agent Ready child → check Gate 3.
5. Debugger run → check Gate 4.
6. Reviewer run → Gate 5. On a bounce, route by failure kind and repeat only the required stage.
7. Repeat per child until every ticket is Done or human escalation is required.

**One item per run** unless the user authorizes a batch — then `subagent-batch-implementation` with lanes, and the parent still holds every gate.

## The bounce loop

```
Debugger Ready → Debugging → bounce → Coding → coder → Debugger Ready → ...
```

Only the debugger reverses state, and only with:

```
bounce:
what is wrong:
evidence (command output):
what coder must change:
verification to re-run:
```

## When a gate fails

Do not proceed to the next stage. Comment the blocker with evidence, leave the state unchanged, and stop. **A stalled pipeline with honest state is recoverable; a moving pipeline with false state is not.**

If the pipeline is already thrashing, load `state-driven-pipeline-recovery`.

## Related

`github-projects-pipeline` · `legacy-planner` · `legacy-coder` · `legacy-debugger` · `state-driven-pipeline-recovery` · `subagent-batch-implementation`
