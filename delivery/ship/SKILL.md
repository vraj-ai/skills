---
name: ship
version: 4.1.0
description: Find, pick up, implement, or execute a feature, bug, task, ticket, or ready issue end to end and open a verified, reviewed PR, then hand it to land. A feature first recalls prior chats and PRs, explains the plan, settles the design with architect and grill, and files issues. A small task goes straight to the build. Builds with poteto-mode, proves the change with the project's verification skill, and keeps a ship record so snapshot and resume-work can continue it.
dependencies: [grill, issues, land, snapshot, principle-independent-verdict, principle-bounded-repair]
recommended: true
argument-hint: "[feature, issue, or task]"
---

# Ship

One entry point from an idea or an issue to merged code. Only land merges, and only under an explicit grant. Ship gathers context, settles the design, files the work, builds it, proves it, and hands it to `land`. Scale every phase to the task.

pstack skills (`/recall`, `/how`, `/why`, `/teach`, `/architect`, `/interrogate`, `/poteto-mode`) turn off model invocation. When the Skill tool refuses one, read its `SKILL.md` from the sibling directory next to this skill and follow it. When pstack is not installed, do the step inline and say so.

## Start

Read AGENTS.md and the tracker pointer, usually docs/agents/issue-tracker.md. Take the user's reference first. Otherwise pick from the ready queue by priority and dependencies, after checking issue bodies, comments, linked PRs, and active owners. A request to find work returns the queue and stops. If nothing is actionable, say so.

Look for an open ship record for this work (format in [references/record.md](references/record.md)). If one exists, this is a resume: run `/resume-work` instead.

Size the task and state the call in one line:

- **Small.** One file or an obvious change, no design fork, no open product question. Go straight to Build.
- **Feature.** Everything else. Run every phase.

Create the ship record now. A small task's record is a few lines. Set its Phase at every section boundary. Build and Prove share the build phase.

## 1. Context

Feature only. The goal is enough understanding to plan, not a survey.

1. `/recall` scoped to this task: prior chats, PRs, reverted fixes, and symptoms users still report. Skip it when the user already gave the branch, PR, and change in hand.
2. `/how` over the subsystems the change touches and `/why` on the code it changes, in parallel. Keep `/why` narrow (git plus the tracker) unless the reasons are the question. `/why`'s Preserve / Change / Avoid / Risk list becomes the design's constraints.
3. `/teach` the user the plan: how the code works now, what will change, and why that shape. pstack's teach runs `how` and `why` itself. Hand it the results already in hand instead. This is the user's chance to correct the plan before design. With no live user, put it in the record and continue.

Write the record's Context section.

## 2. Design

Feature only.

- Name the data shape first, per pstack's principle-model-the-domain.
- A change across a module boundary or a public contract goes through `/architect`. Skipping it is recorded as `architect skipped: <reason>`.
- A fork that running something can settle gets a prototype (poteto-mode's Prototype playbook), not a question.
- A product, preference, or trade-off call no experiment can settle goes to `/grill`. Grill asks only those. Facts come from the code.
- A contested design goes through `/interrogate` before any build.

Write the record's Design section: the chosen design, rejected alternatives, and every grill decision.

## 3. Issues

Feature only. Run `/issues` on the agreed design: one issue per separately verifiable unit, dependency-ordered, each with a Verification-command and the `verify-<app>` feature that proves it. The user's ship request authorizes filing them, unless repo policy says otherwise. Without tracker access, keep the units in the record's Work table and say so.

Issues are the durable plan. Another machine or person resumes from them, not from the record.

## 4. Build

Work the issues in dependency order. Continue an existing branch or PR for the task rather than opening a competing one. Preserve unrelated edits, and use a separate worktree when another writer is active.

- **Small.** Build it here. Use existing patterns and the smallest complete change. Add a focused check for meaningful logic.
- **Feature.** Run `/poteto-mode` inside this skill, with its Feature playbook (Bug-fix for a defect): throughput checkpoint, delegated code against the named data shape, your own review of the delegate's diff, small ordered commits. `/poteto-mode` is not a second delivery path and does not merge. `land` still owns merged.

Apply the poteto-mode principles that fit. Name each one in the PR with the choice it changed. A small task that turns up a design fork stops and goes back to Context.

Update the Work row after each issue.

## 5. Prove

- Run the issue's Verification-command and the repo checks after the final edit.
- When the repo has a `verify-<app>` skill, drive the feature the issue names on the real surface through that skill's launch, doctor, drive, evidence, and cleanup steps. An inconclusive run or a run on the wrong surface is not a pass. A user-facing change with no verification skill gets that gap stated and `/create-verification-skill` offered.
- Keep missing evidence and pre-existing failures explicit. A build pass, an HTTP 200, or a model verdict does not prove untested behavior.

## 6. Review and deliver

Get an independent review of a nontrivial change from the configured reviewer or PR bot, otherwise `/interrogate`. Per principle-independent-verdict, only a context that did not write the code can give the verdict. Fix evidenced blocking findings and reverify. A verdict covers one head SHA: after a push, compare the patch-id of the full PR diff before trusting it. Stop repair after three rounds (principle-bounded-repair) and report the blocker rather than weaken acceptance.

Deliver under repo policy and existing authority: commit, push a named branch, open or update the PR. The PR body holds intent, changed contracts, verification, risks, and `Closes #<issue>`. Implementation never implies deploy, self-merge, or new external messaging authority. Update a decision doc only when a non-obvious decision or constraint changed.

Once the PR is open: if the change added or changed a user-facing feature, or the Prove drive hit a harness gap or doc drift, run `/maintain-verification-skill`. Its corrections ship as their own PR. A change with no user-facing surface skips it and records why.

## 7. Land

Run `/land` on the PRs this run opened. Land keeps the record from here. It merges the verified run only under an explicit user or repo-policy grant, and otherwise stops at merge-ready and reports.

## Stopping

When the session has to stop before done (the user pauses, usage runs low, the context is near full), run `/snapshot`. It completes the ship record, and `/resume-work` continues from it. A finished task needs no snapshot.

A blocker that stops the run (exhausted repair budget, missing access, an unanswered product decision) sets the phase to blocked, with the blocker in Open and its unblocking action in Next.

## Coordination

One owner per task and branch. Delegate when authorized and when independent lanes or a fresh review help. The parent owns integration, the record, and shared status. Children receive explicit ownership, return evidence, and start no orchestration layer of their own. Keep user-specified models, effort, and concurrency limits.

Inside T3 Code, read [references/t3.md](references/t3.md) before dispatching children, working on PRs, monitoring, or verifying a UI. Other hosts use their native capabilities and report missing ones honestly.

## Reply

The PR and head SHA, behavior evidence, review and check status, land outcome, the principles that shaped a decision, and the next action.
