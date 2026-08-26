---
name: grill
version: 1.1.0
description: User-invoked interview that stress-tests a plan and writes glossary, architecture, and ADRs into CONTEXT/. Use when the user runs /grill.
disable-model-invocation: true
argument-hint: "[topic]"
---

# Grill

You were invoked by name. Interview until the design tree is empty. Write durable language and decisions into `CONTEXT/` as they lock. Do not publish tickets. Do not build.

If the user passed arguments, that is the topic.

## Ownership

| Artifact | This skill | Never |
|---|---|---|
| `CONTEXT/glossary.md` | write when a term locks | implementation details |
| `CONTEXT/architecture.md` | write purpose, locked decisions, invariants, non-goals, boundaries when they lock | session diary |
| `CONTEXT/adr/NNNN-slug.md` | write when an ADR is warranted | filler sections |
| `CONTEXT/progress.md` | read | write — `goals` owns it |
| `CONTEXT/goals/**`, `CONTEXT/ship/**` | read | write |

Create `CONTEXT/glossary.md` and `CONTEXT/architecture.md` lazily, only when the first term or decision lands. Never overwrite existing prose; append or replace the one term/decision that just locked.

If `CONTEXT-MAP.md` exists, this is multi-context. Read the map. Write glossary, architecture, and ADRs under the matching context folder the map names. If unclear which context, ask once.

If a root `CONTEXT.md` exists from an older layout, read it as glossary input. New terms go to `CONTEXT/glossary.md`. Do not keep writing the root file.

If `CONTEXT/architecture.md` is missing, create it with Purpose, Locked Decisions, Invariants, Non-goals, Accepted Boundaries, and Ownership. Ownership must say `goals` owns progress, backlogs, goal handoffs, and review verdicts.

## Design tree

Map the topic as a design tree. Every decision branches into the decisions that hang off it.

Work in **rounds**. The **frontier** is every decision whose prerequisites are already settled. Ask the whole frontier in one round. Number each question and give your recommended answer. Wait for the user's answers before the next round.

A question whose answer depends on another question still open in this round belongs to a later round.

```
❓ **Q1** - **<title>**: <body, including choices>

➡️ <your recommended answer>
```

Finding facts is your job. When a frontier question needs a fact from the filesystem, code, or tools, look it up or dispatch a sub-agent. Do not ask the user anything you can observe. A running lookup is an unsettled prerequisite: ask the rest of the frontier now.

The decisions are the user's. Put each to them and wait.

When a frontier fork is architectural (shape, ownership, lock-in), give at least two structurally distinct options before recommending. Whole-shape alternatives, not point fixes inside one shape. Write the caller's usage first, then the type or module shape that would serve it.

When a fork is empirical (behavior, timing, layout, perf), do not ask. Sketch or measure; let the result decide.

When a locked decision is a wide mechanical change (rename a shared symbol, retype a column) whose blast radius fans across the codebase, record it as expand-contract in Locked Decisions: expand, migrate in batches, then contract. Do not pretend it is one tracer bullet.

When a locked decision implies a test, name a candidate verification command in the decision text. `/issues` will lock the real command later.

## Domain modeling

Read `CONTEXT/glossary.md` and `CONTEXT/architecture.md` before the first round. Use the glossary's terms. If the user uses a conflicting word, call it out immediately.

Sharpen fuzzy language. Propose a canonical term and list the others under `_Avoid_`.

Stress-test relationships with concrete edge-case scenarios.

When the user states how something works, check the code. Surface contradictions.

Update `CONTEXT/glossary.md` the moment a term resolves. Do not batch.

`CONTEXT/glossary.md` is a glossary and nothing else:

```md
# {Context Name}

{One or two sentences: what this context is and why it exists.}

## Language

**Order**:
{One or two sentences: what it IS, not what it does.}
_Avoid_: Purchase, transaction
```

Be opinionated. Tight definitions. Only terms unique to this project.

Offer an ADR only when all three are true:

1. Hard to reverse
2. Surprising without context
3. The result of a real trade-off

If any is missing, skip the ADR. A locked decision can still go in `CONTEXT/architecture.md`.

ADRs live in `CONTEXT/adr/` as `0001-slug.md`, `0002-slug.md`, … Scan for the highest number and increment. Create the directory on the first ADR.

```md
# {Short title}

{1-3 sentences: context, decision, why.}
```

Optional: Status, Considered Options, Consequences — only when they add value.

## Done

The session is done when the frontier is empty and the user confirms shared understanding. Do not act on the plan. Do not start `/issues`. Say the grill is locked and `/issues` is the next invocation if they want a spec and tickets.
