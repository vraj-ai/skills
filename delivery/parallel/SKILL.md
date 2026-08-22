---
name: parallel
version: 1.1.0
description: Run ready code items through isolated git worktrees, a fixed GLM 5.2 contributor, locked tests, two independent T0 reviewers, partial-success merging, and compact result digests. Use when goals batches ready code items or when the worktree build farm must resume, review, merge, or report a batch.
dependencies: [council, council-adversary]
---

# Parallel

`parallel` is the worktree-isolated build farm composed by `goals`. It never
mutates `backlog.jsonl`. One item equals one branch and one worktree:

```text
git worktree add -b goals/<slug>/<id> CONTEXT/worktrees/<slug>/<id>
  -> contributor builds test-first and commits
  -> two independent per-item T0 reviewers
  -> merge to MAIN_BRANCH or report failure
```

The fixed contributor is `opencode-go/glm-5.2`. GLM may join research council
rounds but cannot review GLM-authored code.

## The review rubric

Pass this to every reviewer, verbatim, after the correctness brief. Correctness,
security, and data loss are judged first and keep their existing weight. What
follows is the quality pass, and it has three lenses.

> **over-build** — reinvented standard library, a dependency for what the
> platform already ships, an abstraction with one implementation, a factory with
> one product, config nobody sets, a wrapper that only delegates, a flag with one
> caller.
>
> **slop** — a comment restating the line below it, a defensive `try/catch` on a
> path that cannot fail, a cast that silences the compiler instead of fixing the
> type, nesting where a guard clause would return early, code whose shape does
> not match the file it was added to.
>
> **structure** — a new special case bolted into a flow that does not own it,
> feature logic living in a shared path, a bespoke helper duplicating one this
> repo already has, a file this diff pushed past the size the rest of the tree
> keeps.
>
> **One line per finding:** `<file>:<line>: <lens>: <what to cut>. <replacement>.`
>
> **A finding is admissible when it names the replacement** — a standard-library
> function, an existing symbol in this repo, a native platform feature, or
> `delete, nothing replaces it`. Name the replacement and the finding stands.
> Without one it is an opinion about taste, and taste does not block a merge.
>
> An admissible `over-build` or `structure` finding is **P1** and blocks the
> merge. `slop` is **P2**. Cap the quality pass at **5 findings**, ranked biggest
> cut first, and print `net: -<N> lines possible.` on its own line, or
> `Lean already.` for a clean item. **It goes immediately before `VERDICT:`**,
> never after `FOLLOWUPS:`: the result contract parses the last three lines, so
> a trailing net line displaces the verdict and invalidates the whole review.
>
> One runnable check per piece of non-trivial logic (`assert`, `demo()`, or one
> small test) is the required minimum and is never an `over-build` finding.
> Missing trust-boundary validation, data-loss handling, security,
> accessibility, or an unmet acceptance criterion stays P0/P1 under-build.

The rubric is adapted from [ponytail-review](https://github.com/DietrichGebert/ponytail)
(MIT, DietrichGebert), Cursor's `deslop` and `thermo-nuclear-code-quality-review`,
and [@elithrar](https://github.com/elithrar)'s `simplify`. It is inlined here for
the same reason the ladder is: worktree subagents may not load plugins.

## Batch input

`MAX_BATCH` defaults to 3 and is capped at 4. Goals marks all selected ids
`in-progress` atomically before invoking parallel. The CLI manifest is one line
per item:

```text
<id>|<branch>|<model>|<task prompt>
```

The task contains the plan/item path, exact acceptance criteria, locked
Verification-command, MAIN_BRANCH, and absolute worktree path. Set
`TEST_CMDS_JSON` to a complete JSON map from id to its locked command;
`TEST_CMD` is only accepted for a one-item batch. Reject any manifest model
other than the fixed contributor pin.

## CLI path

When `OPENCODE_BIN`, `~/.opencode/bin/opencode`, or `opencode` on `PATH` is
available, run:

```bash
delivery/parallel/scripts/parallel.sh <repo-root> <worktree-root> <manifest>
```

The runner creates worktrees and launches one
`opencode run --dir <worktree> --model <model>` process per item concurrently.
CLI cannot directly select a `mode: subagent` agent, so each process uses the
built-in Build primary with an injected `task: deny` permission; reviewer
processes additionally receive `edit: deny`. It waits for committed worker
results, runs the locked command, then launches pinned Grok and Kimi review
models concurrently per item in disposable detached review worktrees, so shell
activity cannot alter the contributor branch. Full output goes to `.log` files;
only result contracts return to goals.

## In-session fallback

If no OpenCode binary exists, goals creates every worktree, then sends one
tool message containing one `contributor` task call per item. Each worker is
told to operate only inside its absolute worktree, build test-first, run the
locked command, and commit.

After workers finish, goals sends one message containing two task calls per
item (`council-grok`, `council-kimi`). Review each item independently. A
conflict gets one dedicated resolver call. Goals runs the locked command and
passes its evidence to the shell-disabled, edit-disabled reviewers. The
fallback emits the same JSON contract as the CLI path.

## T0 and merge rules

- Two reviewers per item, always. No verdict means no merge.
- Any evidenced P0/P1 blocks even if a reviewer mistakenly prints `PASS`.
- **Both reviewers apply the review rubric above** — the `over-build`, `slop`,
  and `structure` lenses, the named-replacement admissibility rule, and the
  `net: -<N>` close.
- `HARDENED=1` adds one read-only `council-adversary` T0 pass.
- Partial success is default: merge green/PASS peers and report failed ids.
- `STRICT_BATCH=1` integrates on a temporary branch and fast-forwards
  MAIN_BRANCH only when the whole batch succeeds, so a late failure cannot
  leave earlier peers merged.
- Goals alone integrates. Workers commit only their item branch; reviewers do
  not edit; no child updates the backlog or issue labels.

For overlap, begin a no-commit merge. Keep both unique non-overlapping hunks.
For the same hunk, prefer the incoming branch only inside its declared
`files_touched`; otherwise prefer HEAD. Remove markers and run `TEST_CMD`. If
still red, `git merge --abort`, mark that item failed, and continue the wave.
After a resolver edits the integration, materialize an immutable candidate
commit and rerun two independent T0 reviews in separate detached worktrees
before committing the same tree.

## Results contract

Every batch atomically writes:

```json
{"main_branch":"...","merged":[{"name":"...","branch":"...","sha":"...","verdict":"PASS"}],"blocked":[],"failed":[],"conflicts":[]}
```

Every item writes a compact one-line `<id>.digest.json`:

```json
{"id":"...","verdict":"PASS|FAIL","files_touched":[],"tests":{"pass":0,"fail":0,"cmd":"..."},"findings":[],"followups":[]}
```

Goals ingests only these files, never logs. `results.json`, digests, branch
ancestry, and Git are producer truth for Phase R.
