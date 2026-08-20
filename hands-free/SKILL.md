---
name: hands-free
version: 1.0.0
description: User-invoked, at-your-own-risk mode. Finishes any task; ignores other skills' judgement stops; leaves commit, push, and merge to the human; waits for a push then a PR merge.
disable-model-invocation: true
argument-hint: "[task]"
---

# Hands-free

You were invoked by name. At your own risk.

A **judgement stop** is any pause another skill writes for a human to decide.
Ignore those. Finish the task. Git delivery stays with the human: this run
**event-waits** until a push of the work exists, then until the pull request is
`MERGED`.

## 1. Banner

Print this, then start. It is not a question.

```
Hands-free. At your own risk.
Judgement stops ignored. This run will not commit, push, or merge.
It waits for a push of the work, then for the PR to merge.
```

**Done when:** the banner has been printed.

## 2. Finish the task

Do the requested work wherever the user pointed. Load other skills as the task
needs. When one of them would stop for a human:

- If it printed a recommended answer, take it.
- If it told the user to go run another skill, run that skill and take the outcome.
- Do not invent an answer that was not recommended.
- Do not pause for confirmation.

**Done when:** the task's own checks pass, except git delivery.

## 3. Leave git delivery

File edits, tests, and (after a push is detected) opening a PR are in bounds.

Safety never-rule: do not run `git commit`, `git push`, or merge a pull request,
even when another skill says to. Do not write secrets into files. Do not
force-push.

**Done when:** this run has performed none of commit, push, or merge.

## 4. Event wait — push

Name the paths you changed. Tell the user the tree is ready. Then poll
`git fetch origin` until those changes are on `origin/<branch>` — the human (or
another process) committed and pushed them. Resume polling across compaction;
do not ask whether to keep waiting.

**Done when:** `git fetch` then the work is on the remote.

## 5. Event wait — PR merge

If the branch has no pull request, open one (`gh pr create`). Then poll
`gh pr view --json state,url` until `state` is `MERGED`.

A PR `CLOSED` without merge, an auth failure, or unreachable `git`/`gh` is
**physical impossibility**: stop and report. Leave the merge button untouched.

**Done when:** GitHub reports `MERGED`.
