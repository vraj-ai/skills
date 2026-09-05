---
name: snapshot
version: 1.4.0
description: User-invoked session close. Syncs CONTEXT/ and the issue tracker, writes a handoff, then commits and pushes under /snapshot authority. Use when the user runs /snapshot.
dependencies: [push-handoff]
disable-model-invocation: true
argument-hint: "[next session focus]"
recommended: true
---

# Snapshot

You were invoked by name. Close the session. Docs are the source of truth. The tracker is a view. A handoff is not a push. This skill then delivers.

## Worker Roles

The invoking Role is the orchestrator. It may spawn named Worker Roles one level
deep through the host's native mechanism:

- `researcher` — look up filesystem, code, tracker, or web facts.
- `small-task` — run a bounded command or prepare a mechanical draft in a
  separate lane.

Workers never spawn. They return evidence or drafts; `snapshot` applies its own
CONTEXT flush and handoff writes. Do not use a host API, path, or provider name
as a Role identity. The orchestrator alone writes any backlog or lock and
performs any push.

If the user passed arguments, that is what the next session will focus on.

## Ownership

Flush this session's locked language and decisions into the same artifacts `/grill` owns: `CONTEXT/glossary.md`, `CONTEXT/architecture.md`, `CONTEXT/adr/`. Never overwrite unrelated prose.

Never write `CONTEXT/progress.md`, `CONTEXT/goals/**`, `CONTEXT/ship/**`, or any backlog. `goals` and `ship` own those. If `CONTEXT/goals/<slug>/lock.d/` or `CONTEXT/ship/<slug>/lock.d/` is held, leave it. Report that resume belongs to that pipeline.

## 0. Preflight

```
git status -sb
git rev-parse --abbrev-ref HEAD
git remote -v
```

Note dirty paths you do not own. They stay untouched.

If this repo's convention is PRs into `main`, do not push to `main`. Push a named branch and open a PR.

## 1. Flush CONTEXT/

If a term or decision locked in this session and is not yet in `CONTEXT/`, spawn a `researcher` Worker Role to check the evidence, then write it now. Same rules as `/grill`: glossary is language only; architecture is purpose, locked decisions, invariants, non-goals, boundaries; ADRs only when hard to reverse, surprising, and a real trade-off.

If a root `CONTEXT.md` exists as this clone's local glossary (vskills itself), update that file's Language section instead of inventing a second glossary.

Read the files you just wrote. They are the source of truth for step 2.

## 2. Sync the tracker

If `docs/agents/issue-tracker.md` is missing, skip the tracker and say so. Do not run setup. That is `/issues`.

Using that file's commands:

- Update open tickets this session touched whose bodies contradict the docs. Comment with the doc path. Do not silently rewrite history.
- If architecture Non-goals or Out of Scope now kill a ticket, close it with a comment pointing at the doc.
- If a locked decision changed an acceptance criterion, update that criterion and say so in a comment.
- Do not create new specs or tickets. That is `/issues`.
- Do not apply or rotate `goals:*` labels. The pipeline owns those.
- Leave `ready-for-agent` on tickets that are still agent-grabbable.

A failed tracker write is a report, not a reason to skip the handoff.

## 3. Handoff artifact

Write a handoff to the OS temp directory, not the workspace. Do not duplicate specs, plans, ADRs, issues, commits, diffs, or test output. Reference them by path or URL.

Sections: Objective, Important Details, Work State, Next Move, Relevant Files, Suggested Skills.

Redact secrets, tokens, passwords, and PII. Short declarative sentences. No jargon.

If the user described the next session, tailor Next Move to it.

This file is not staged. If the project tracks its own handoff archive, stage that copy only when project rules require it.

## 4. Verify

If this run changed code or skills, spawn a `small-task` Worker Role in an isolated lane to run the verification command after the final edit and return its verbatim output. For this skills repo that is `npm test` or the narrower tests that cover the change. A red gate does not push.

If this run only synced docs and tracker, the gate is: CONTEXT writes succeeded, and tracker writes either succeeded or were reported.

If this run added, renamed, or deleted docs under a folder indexed by a retrieval router (`ROUTER.md` + generated `index*.md`), regenerate that index before staging.

## 5. Deliver

Invoking `/snapshot` is the push authority `push-handoff` Step 0 requires. Follow `push-handoff` for stage, commit, push, and remote SHA proof.

- Stage only paths this session owns. Never `git add -A`. Unrelated dirty files are sacred.
- Sweep junk: duplicate `file 2.ts`, build output, editor temps.
- Scan the diff for secrets.
- Commit as `type(scope): subject` with a why body. `type` is `feat` `fix` `test` `refactor` `docs` `chore`. Add `Refs: #n` when an issue exists.
- `git push`, then `git rev-parse HEAD`, then `git fetch origin` and `git rev-parse origin/<branch>`. "Pushed" is only true when those SHAs match.
- Never force-push. Never `--no-verify`. Never push a red gate.

If there is nothing to commit, write the handoff, skip the push, and say so.

Protected branch or PR-only `main`: push a named branch, open a PR, report that. Do not merge it.

Then, if `docs/agents/issue-tracker.md` exists, write one tracker closeout review using its commands. Read issues, pull requests, and commits this session produced or touched. Post one comment on the parent spec or open PR (GitHub: `gh issue comment` / `gh pr comment`): SHA, docs written, remaining follow-ups. Do not create tickets. Do not rotate `goals:*` labels. A failed tracker write is a report, not a reason to undo the push.


## Recovery

| Failure | Do this |
|---|---|
| Auth failure | Report the exact error and the recovery command. Do not retry blindly. |
| Non-fast-forward | Fetch, inspect, rebase only if local work is unpushed and clean. Never force. |
| Protected branch | Open a PR. Stop. |
| Pre-commit hook fails | Fix the underlying issue. |

## Report

```
Handoff: <tmpdir path>
Commit: <sha or none>
Branch: <name>
Remote: <origin/branch> @ <sha>   fetched readback, or skipped
Gate: <command> pass or skipped
Docs: <CONTEXT files written>
Tracker: <issues updated / closed / skipped>
Review: <spec/PR comment posted / skipped>
Files: <staged paths>
```
