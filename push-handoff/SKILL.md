---
name: push-handoff
version: 2.3.0
description: Commit and push a verified handoff plus its artifacts, only under explicit authority, and prove the push happened by reading the remote SHA back. Use as the final delivery step after artifacts are ready, when the user asks to push work, or when a handoff needs to reach the remote. Refuses to claim success without remote proof and never force-pushes or commits secrets.
---

# push-handoff — authorized commit & push of verified work

The last step of a chain, and the one most likely to produce a **false claim**. "Pushed" is a fact about a remote, not a feeling about a command.

## Handoff boundaries

Three related operations have different owners and must not be collapsed:

- Context compaction produces a redacted handoff artifact in the OS temporary directory. It does not commit or push.
- `goals` owns `CONTEXT/goals/<slug>/handoff.md` as the small, durable resume cursor for a goal run.
- This skill performs authorized delivery of an already-prepared handoff and its artifacts. It verifies, stages, commits, pushes, and proves the remote SHA.

When both context compaction and delivery are needed, produce the handoff artifact first and run `/push-handoff` second. A handoff never implies a push. A pipeline may invoke this skill directly when its handoff and artifacts already exist.

## Handoff artifact input

This skill delivers a handoff; it does not synthesize one from memory. Before
staging, require the already-generated handoff artifact in `$TMPDIR`. If the
run needs a handoff but no artifact exists, stop and have one produced rather
than inventing a second format.

The temp file is not staged. If a project has its own tracked handoff archive,
stage that project-owned copy only when the project rules explicitly require it.

## Step 0 — Authority check

Push only when one of these is true:

- The user explicitly authorized commit/push for this run.
- The active skill chain was invoked with push in scope (e.g. `/planner` including its final push step).
- A standing project rule grants it (e.g. an auto-push skill the user configured).

If none hold: **stop, write the handoff to disk, and report that push needs authorization.** Do not push "to be helpful."

## Step 1 — Verify before you commit

Never push unverified work.

- The ticket's `Verification-command` has been run **after the final edit**, and passed.
- You have its **verbatim output** in hand.

If the gate is red, you are not pushing. You are reporting a blocker.

## Step 1b - Regenerate the docs index

If this run added, renamed, or deleted anything under the repo's docs folder - a
handoff, an ADR, a ticket - and that folder is indexed by a **retrieval router**
(`ROUTER.md` + generated `index*.md`), regenerate before staging:

```
npm run graph:index        # or whatever task the repo wired
```

Stage the regenerated index alongside the doc that caused it. An index that
drifts one commit behind its folder is worse than no index: the next agent
scores against a catalogue that no longer describes the shelf, opens the wrong
file, and trusts it. Where the repo ships a `--check` mode, run that instead and
regenerate only if it reports drift.

## Step 2 — Stage narrowly

```powershell
git status -sb
```

- Stage **only** paths this ticket owns.
- **Unrelated dirty files are sacred** — someone else may be mid-edit in a shared worktree. Never `git add -A` / `git add .`.
- Sweep for junk before staging: duplicate `file 2.ts` artifacts from sloppy tools, stray build output, editor temp files.
- **Scan the diff for secrets** — keys, tokens, `.env` contents, connection strings. A pushed secret is a rotation incident, not an oops.

## Step 3 — Commit

```
type(scope): subject

<body — why, not what>

Refs: #123
```

`type` âˆˆ `feat` `fix` `test` `refactor` `docs` `chore`.

The `Refs:` trailer links the commit to the GitHub issue in the Project. Use
`Refs: #123` in the same repository or `Refs: owner/repo#123` across repositories.
Omit it and the ticket loses its evidence trail.

## Step 4 — Push and PROVE it

```powershell
git push
git rev-parse HEAD
git fetch origin; git rev-parse origin/<branch>
```

The claim "pushed" is only valid when **local HEAD SHA == remote branch SHA**, read back after a fetch. Paste both.

A successful-looking `git push` that raced with someone else, hit a protected branch, or went to the wrong remote will still print encouraging output.

## Step 5 — Report

```
Commit: <sha>
Branch: <name>
Remote: <origin/branch> @ <sha>   â† fetched readback
Gate: `<command>` â†’ pass
Files: <list>
```

## Never

- **Never force-push.** Not with `--force`, not with `--force-with-lease`, unless the user explicitly asks and understands what's being overwritten.
- Never commit secrets.
- Never stage paths outside the ticket.
- Never claim push success without the fetched remote SHA.
- Never push a red gate.
- Never push to `main` on a repo whose convention is PRs — check the convention first.

## Recovery

| Failure | Do this |
|---|---|
| Auth failure | Report it with the exact error and recovery step (`gh auth login` etc.). Do not retry blindly. |
| Non-fast-forward | `git fetch`, inspect the divergence, rebase **only** if the local work is unpushed and clean. Never force. |
| Protected branch | Open a PR instead; report that push-to-branch is not the delivery path here. |
| Pre-commit hook fails | Fix the underlying issue. Never `--no-verify` unless the user asked. |
