---
name: issues
version: 1.3.0
description: User-invoked. Sets up a project's tracker and CONTEXT/ once, then turns a grill into a spec and tracer-bullet tickets. Use when the user runs /issues.
disable-model-invocation: true
argument-hint: "[spec-ref]"
recommended: true
---

# Issues

You were invoked by name. Turn a locked grill (or a passed spec reference) into a published spec and tracer-bullet tickets. Do not interview. Do not build.

## Worker Roles

The invoking Role is the orchestrator. It may spawn named Worker Roles one level
deep through the host's native mechanism:

- `researcher` — look up filesystem, code, tracker, or web facts.
- `small-task` — perform a bounded lookup or mechanical task when a separate lane
  helps.

Workers never spawn. They return evidence only; `issues` remains responsible for
its CONTEXT, spec, tracker, and ticket writes. Do not use a host API, path, or
provider name as a Role identity. The orchestrator alone writes any backlog or
lock and performs any push; this skill normally owns none of those artifacts.

If role configuration is absent, mention once that the host's defaults will be used. Do not block or write host configuration unless the user asks in this run.

If the user passed a spec path, issue number, or URL, spawn a `researcher` Worker Role to fetch and inspect it. Otherwise synthesize from this conversation and `CONTEXT/`.

## 0. Setup, once per project

Skip this whole section when `docs/agents/issue-tracker.md` already exists. A new folder or clone without that file is a new project.

### 0a. Durable context

If `CONTEXT/architecture.md` is missing, create missing files only. Never overwrite.

Write `AGENTS.md` if missing:

```md
# Agent Instructions

Read `CONTEXT/glossary.md` for language.
Read `CONTEXT/architecture.md` before changing project structure or durable decisions.
Read `CONTEXT/progress.md` for the current verified milestone pointer.

Keep durable decisions in `CONTEXT/architecture.md`, keep progress bounded, and
use the project's tests, builds, git history, and goal artifacts as evidence.
Do not turn `CONTEXT/progress.md` into a session diary.
```

Write `CONTEXT/architecture.md` if missing, with Purpose, Locked Decisions, Invariants, Non-goals, Accepted Boundaries, and Ownership. Ownership: `AGENTS.md` is the router; this file is human-owned; `CONTEXT/progress.md` is a derived pointer; `goals` owns goal backlogs, handoffs, progress updates, and review verdicts.

Write `CONTEXT/progress.md` if missing:

```md
# Progress

Current milestone: Not started
Last verified edit: none
```

Add only runtime paths to `.gitignore` if they are not already there: `CONTEXT/goals/*/backlog.jsonl`, `CONTEXT/goals/*/lock.d/`, `CONTEXT/worktrees/`, `*.log`, `results.json`, `*.digest.json`. Do not ignore `CONTEXT/architecture.md`, `CONTEXT/glossary.md`, `CONTEXT/progress.md`, or `CONTEXT/adr/`.

If `setup-vskills` is installed, you may run its `scripts/init-context.mjs` against this project root instead of writing the three files by hand. It is create-if-missing. Still write `CONTEXT/glossary.md` lazily later, and still do 0b.

If role configuration is absent, mention once that the host's defaults will be used. Do not block or write host configuration unless the user asks in this run.

### 0b. Tracker and labels

Ask which tracker this project uses. Recommend from evidence: a GitHub remote → GitHub; a GitLab remote → GitLab; no remote → local markdown. Always let the user pick.

Options:

- **GitHub** — `gh issue create`. Native blocked-by when available.
- **GitLab** — `glab issue create`. Native `/blocked_by` when available.
- **Linear** — the Linear CLI the user has (`lin` or `linear`). If neither works, treat as Other.
- **Local markdown** — files under `CONTEXT/issues/<feature-slug>/`.
- **Other** — user describes the workflow in one paragraph; record it as prose.

Then ask whether to keep the default labels. Recommend yes.

Defaults: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. On GitHub or GitLab, create those plus `goals:planned`, `goals:ready`, `goals:in-progress`, `goals:blocked`, `goals:failed`, `goals:done`, `goals:cancelled` now (`gh label create <name> --force` / `glab label create`). Do not apply a `goals:*` label at publish time; that is the pipeline's job.

Write:

- `docs/agents/issue-tracker.md` — tracker choice and the commands this skill will use
- `docs/agents/triage-labels.md` — role → label string table
- `docs/agents/domain.md` — consume `CONTEXT/glossary.md`, `CONTEXT/architecture.md`, `CONTEXT/adr/`; proceed silently if a file is missing

If `AGENTS.md` exists, add or update an `## Agent skills` block pointing at those three files. Do not duplicate the block. Do not replace unrelated sections.

For GitHub, `docs/agents/issue-tracker.md` must include: `gh issue create`, `gh issue view <n> --comments`, `gh issue list`, `gh issue comment`, `gh issue edit --add-label` / `--remove-label`, `gh issue close`. Blocking: GitHub native dependencies via `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` where `<blocker-db-id>` is `gh api repos/<owner>/<repo>/issues/<n> --jq .id`, not the `#number`. Fallback: a `Blocked by: #<n>` line. Infer the repo from `git remote`.

## 1. Synthesize the spec

Do not interview. Explore the repo if you have not. Use glossary terms. Respect ADRs.

Sketch the test seams. Prefer existing seams. Prefer the highest seam. The ideal number of new seams is zero, then one. Check those seams with the user before writing the spec.

Write the spec with these sections: Problem Statement, Solution, User Stories (long numbered list, `As an <actor>, I want a <feature>, so that <benefit>`), Implementation Decisions (modules, interfaces, schema, API contracts — no file paths unless a prototype snippet encodes a decision), Testing Decisions (external behavior only, which modules, prior art in this repo), Out of Scope, Further Notes.

## 2. Draft tickets

Break the spec into tracer-bullet tickets.

- Each slice is a narrow complete path through every layer. Demoable on its own. Sized for one fresh context window.
- Prefactor first.
- Each ticket lists the tickets that block it.
- Each ticket has a runnable **Verification-command** derived from Testing Decisions and the repo's test config. An item with no command is not ready.
- Wide mechanical changes are expand-contract, not one tracer bullet: expand (new form beside old), migrate in blast-radius batches, contract (delete the old form). Each batch is its own ticket.

Present the breakdown. For each ticket: title, blocked by, what it delivers, verification command. Ask: granularity, blocking edges, merge or split. Iterate until the user approves.

## 3. Publish

Publish the spec first, then tickets in dependency order (blockers first). Apply `ready-for-agent` unless the user said otherwise. Do not close or edit a parent issue that already existed.

**GitHub / GitLab / Linear:** one issue per ticket. Native blocking or sub-issue links where the platform has them; otherwise a `Blocked by` line. Create labels on demand with the platform's force/upsert.

**Local:** `CONTEXT/issues/<feature-slug>/spec.md` and `CONTEXT/issues/<feature-slug>/<NN>-<slug>.md`, numbered from `01`. Never one combined tickets file.

Ticket body:

```md
## Parent

<parent spec reference, or omit>

## What to build

<end-to-end behaviour from the user's perspective>

## Acceptance criteria

- [ ] …

## Blocked by

<references, or "None — can start immediately">

## Verification-command

`<command that exits 0 when this ticket is done>`
```

Avoid file paths and code except a prototype snippet that encodes a decision.

## 4. Stop

Print the spec reference and the ticket list. Ask `/ship` (lean, unattended) or `/goals` (milestone stops, more review). Wait. Do not start either.

Then write one tracker closeout review using `docs/agents/issue-tracker.md` commands. Read the issues, pull requests, and commits this session produced. Post one comment on the parent spec (GitHub: `gh issue comment` / `gh pr comment`) covering what was published and remaining follow-ups. Do not create extra tickets. Do not rotate `goals:*` labels. If the tracker file is missing, skip and say so.
