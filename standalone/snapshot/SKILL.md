---
name: snapshot
version: 3.0.0
description: Save where you are: checkpoint an unfinished or half-done task so a later session picks it up at the exact phase, before a pause, a context reset, or a task switch. Completes the ship record with live state, the next action, and the context and design this session learned, so resume-work needs no fresh recall. Grants no commit, push, or external-write authority.
dependencies: [push-handoff]
argument-hint: "[next session focus]"
recommended: true
---

# Snapshot

Checkpoint unfinished work. `resume-work` is the pickup half: it re-proves these claims against the repo before continuing. A completed task needs only its final report. Snapshot grants no commit, push, merge, or external-write authority.

An in-chat catch-up maps to pstack `/ketchup`: what changed since the user's last message, with no resume file. pstack pause-safely does not replace it either. Neither one records the head SHA and the phase, so the record stays.

## Write the record

Write the ship record at `$(git rev-parse --git-common-dir)/vskills/ship/<slug>.md` in the shape ship's references/record.md defines. Update the existing record when ship or land started one. For work that never went through ship, create one anyway, so `resume-work` reads a single format.

Inspect live state first. Do not copy it from memory: run git status, find the branch, head SHA, and uncommitted work, and check the issue or PR state and the last verification with its limits. Preserve unrelated edits.

Then fill the record so it meets its bar: a fresh agent reading only the record and the files it anchors continues at Next without re-running `recall`, `how`, `why`, or `teach`.

- **Phase and Next.** The phase the work is in, and one concrete next action, specific enough to start without asking.
- **Context.** The mental model this session built, with file:line anchors. The constraints. The dead ends, so the next session does not retry them. Write what took this session effort to learn. Skip what a quick read of the code shows.
- **Design.** The decisions and their reasons, rejected alternatives, and grill answers. A decision that will outlive this task also goes in the project's decision doc.
- **Work.** Per issue: branch, PR, head SHA, verification state.
- **Open.** Unresolved decisions, the blocker, and non-obvious assumptions.

Link artifacts instead of copying them. Rewrite sections; don't append a diary.

## Reach and limits

The record is local to this clone. For another machine or person, also post a short pointer (phase, next action, branch, and whether it is pushed) on the issue or PR when tracker authority exists. State whether the branch changes are actually pushed. If delivery is separately requested, follow repo verification and commit or push policy, with push-handoff as the explicit delivery path. Otherwise leave code and service state alone.

Never write another pipeline's state. Update a tracker item only when its status would otherwise mislead.

Return the record path, its persistence limits, and one paste-ready line: `/resume-work <slug>`.
