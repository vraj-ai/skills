---
name: ship
version: 3.0.0
description: Find or carry out a referenced task using the project's tracker, source, verification, and delivery rules. Return a verified, reviewed PR or an evidenced blocker.
dependencies: [council-adversary]
recommended: true
argument-hint: "[issue-or-task] [program]"
---

# Ship

Use existing work and let the model choose a suitable implementation. A referenced issue or clear task is sufficient input. A request to find available work returns the actionable queue without starting implementation.

## Resolve the task

Read AGENTS.md and the tracker pointer, usually docs/agents/issue-tracker.md. Prefer the user's explicit reference. Otherwise use the project's ready queue and priority/dependency rules. Inspect issue bodies, comments, linked PRs, dependencies, and active owners before selecting work. Do not select the newest spec merely because it is newest. If nothing actionable is selected, report that rather than inventing work.

Inspect the checkout and relevant code/tests. Preserve unrelated edits; use a separate worktree when another writer is active. Resume this task's existing branch or PR and avoid competing owners or duplicate PRs.

## Complete and prove it

Honor the outcome, acceptance, and existing authority. Resolve facts through inspection or experiments. Record small reversible assumptions; ask only for a consequential product decision or actual blocker. Use existing patterns and the smallest complete change. Add focused checks for meaningful logic or regressions where practical; choose an appropriate testing method rather than enforcing one for every edit.

Run the task's Verification-command and appropriate repo checks after the final edit. Verify runtime/UI behavior when acceptance depends on it. Keep missing evidence and pre-existing failures explicit. A model verdict, build pass, or HTTP success does not establish untested behavior.

Get an independent review for a nontrivial change, using the configured reviewer or PR bot where appropriate. Review intent, affected callers, correctness, and scope. Fix evidenced blocking findings and reverify. Reviews and CI apply to the examined head SHA; recheck after a push. Bound repeated repair to three rounds, then report the blocker instead of weakening acceptance.

Deliver under repo policy and existing user authority: commit, push a named branch, and open/update a PR when authorized. Implementation does not silently grant deployment, self-merge, or new external messaging authority. Return PR/head SHA, behavior evidence, review/check status, and next action. Put intent, changed contracts, verification, and risks in the PR. Update durable docs only when a non-obvious decision or constraint changed. A completed task does not require /snapshot.

## Coordination

Use one owner per task and branch. Delegate when authorized and independent lanes or a fresh review help. The parent owns integration and shared status; children receive explicit ownership and return evidence. They do not start another orchestration layer. Keep user-specified models, effort, and concurrency limits.

Inside T3 Code, read [references/t3.md](references/t3.md) when dispatching children, working on PRs, monitoring, or verifying a UI. Use native T3 capabilities rather than another CLI farm. Other hosts use available native capabilities and report missing ones honestly.

For an explicitly requested resumable program, or an existing CONTEXT/ship backlog, read [references/program.md](references/program.md). Preserve existing locks, state, and ownership during recovery. That profile and /goals retain the larger farm/milestone machinery; ordinary issue work creates no local backlog or mandatory milestone/final-adversary ceremony.
