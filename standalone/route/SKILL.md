---
name: route
version: 1.2.0
description: Map a task to the right vskills skill — reads what the user is trying to do, names the matching skill (or sequence), and hands back a paste-ready invocation. Use when unsure which skill fits, where to start, or what to run, or as the entry point to the pipeline.
disable-model-invocation: true
argument-hint: "[what you're trying to do]"
recommended: false
---

# Route

The entry question is what the user wants to happen next, not which skill
sounds related. Match the intent below, name the skill, and stop — routing is
not doing the work.

| Intent | Skill |
|---|---|
| Unclear or consequential product/design choice | `grill` |
| Turn an agreed outcome into tracker work | `issues` |
| Build a feature, fix, or referenced issue end to end, from context through design, issues, build, and land | `ship` |
| Drive open PRs to merged: checks, threads, stacks, overnight runs | `land` |
| Understand a subsystem, a call chain, or a blast radius — no changes | `investigate` |
| A bug or regression whose cause isn't known | `debug` |
| Checkpoint unfinished work for a later session | `snapshot` |
| Continue stopped work at the phase it stopped | `resume-work` |
| Commit and push under explicit authority, proven by remote SHA | `push-handoff` |
| Install the GitHub-Actions review bot into a repo | `pr-review` |
| Audit a whole codebase into a ranked ticket backlog | `audit` |
| The constraint, not the code, decides whether work can ship | `delivery-constraints` |
| One-ticket TDD at a real production seam | `implementation-tdd` |
| Delegate parallel lanes without losing ownership | `subagent-delegation` |
| Decide between approaches or harden a choice | `ponytail` |
| Cost/throughput model for an AI subscription or provider | `ai-subscription-unit-economics` |
| Benchmark a model's tokens-per-second | `test-tps` |
| Turn a docs folder into a retrieval graph | `setup-obsidian` |
| Install vskills on a new machine or harness | `setup-vskills` |

Principles are not entry points — they are disciplines the delivery skills
invoke: real-artifact, evidence-over-report, bounded-repair, named-constraints,
independent-verdict. Name one when the user is asking how to think, not what to
run.

## The usual sequences

- Any task → `ship`. It runs the context, design, grill, and issues steps a
  feature needs and hands off to `land`. A small task goes straight to its build.
- Product questions only, nothing to build yet → `grill`. Agreed work to queue
  without building → `issues`.
- "Is it broken?" → `investigate`; "fix it" → `debug` → `ship` → `land`.
- Away and back, or a usage limit → `snapshot` out, `resume-work` in.
- Crosses modules, a design fork, or the cause is still unknown during the build → `ship` only. `/poteto-mode` runs inside `ship`. Do not route that request to `/poteto-mode` as well.
- Catch me up on this chat → pstack `/ketchup`, not `snapshot`. A later session still needs `snapshot`.

pstack is installed beside this catalogue. It is not a route. `/how`, `/architect`, and `/interrogate` are hand-offs from `grill`. `/ketchup` is the in-chat catch-up that `snapshot` maps to. None of them is a destination in the table above.

## The reply

One line per hop: the skill, why it fits, and the invocation to paste —
`/route` answers like "`issues` — the outcome is agreed, it needs tracker work:
`/issues spec.md`". When no skill fits, say so plainly instead of forcing the
nearest one.
