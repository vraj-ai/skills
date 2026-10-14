---
name: snapshot
version: 2.2.0
description: Checkpoint unfinished or half-done work — save a concise resume note so a fresh session or task can pick it up. Preserve missing state and the next action without repeating delivery or rebuilding project context.
dependencies: [push-handoff]
disable-model-invocation: true
argument-hint: "[next session focus]"
recommended: true
---

# Snapshot

Checkpoint unfinished work so a fresh session can continue. A completed task needs only its final report. Snapshot itself grants no commit, push, merge, or external-write authority. `resume` is the pickup half — it re-proves these claims against the repo before continuing.

An in-chat catch-up maps to pstack `/ketchup`: what changed since the user's last message, with no resume file. This skill still writes the resume note (branch, head SHA, next action). pstack pause-safely does not replace it. `/ketchup` leaves the SHA out, so the note stays.

Inspect git status, issue/PR, verification, and remaining work. Preserve unrelated edits. When goals or ship owns a handoff/backlog/lock, leave those artifacts to its owner and provide the resume pointer. Never write CONTEXT/progress.md or another pipeline's state.

Save only missing resume information:

- Objective and issue/PR.
- Worktree, branch, head SHA, and uncommitted work.
- Last verification and its limitations.
- Blocker, unresolved decision, or non-obvious assumption.
- Next concrete action and constraints.

Use an existing project handoff location. A local session note may use the OS temp directory or $TMPDIR; report its path and local-only lifetime. For another machine or person, use an authorized durable task location and state whether branch changes are actually pushed. Link artifacts instead of copying their contents.

Update a decision doc only if a consequential decision is missing. Update a touched tracker item only when status or acceptance would otherwise mislead, using docs/agents/issue-tracker.md and existing authority. Avoid a duplicate delivery closeout comment.

If delivery is separately requested, follow repo verification and commit/push policy; push-handoff remains the explicit delivery path. Otherwise leave code and service state alone. Return the note, persistence limits, and one paste-ready resume instruction.
