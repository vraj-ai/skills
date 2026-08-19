---
name: ship-parallel
version: 1.0.0
description: Run ready code items through isolated git worktrees with a lazy-senior-dev build brief, gate-first review by one non-maker model, and partial-success merging. Use when ship batches ready code items or when the lean worktree build farm must resume, review, merge, or report a batch.
---

# Ship Parallel

The worktree-isolated build farm composed by `ship`. Forked from `parallel` and
kept lean: **one contributor, one reviewer, and the reviewer only runs if the
gate is already green.** It never mutates `backlog.jsonl`.

One item equals one branch and one worktree:

```text
git worktree add -b ship/<slug>/<id> CONTEXT/worktrees/ship/<slug>/<id>
  -> contributor builds to the ladder, commits
  -> ship runs the locked Verification-command
  -> green? one non-maker reviewer. red? straight back, no model spent
  -> merge to MAIN_BRANCH or report failure
```

The fixed contributor is `opencode-go/glm-5.2`. A model never reviews its own
code.

## The ladder

Pass this to every contributor, verbatim. It is the whole build brief.

> **Work down these rungs in order. Stop at the first one that solves it.**
>
> 1. **Necessity** — does this need to exist at all? (YAGNI)
> 2. **Codebase reuse** — is it already implemented in this project?
> 3. **Standard library** — does the stdlib solve it?
> 4. **Native platform** — can built-in features (CSS, HTML5 inputs, DB constraints) handle it?
> 5. **Existing dependencies** — use what is installed before adding anything
> 6. **One-liner** — can this be a single line?
> 7. **Minimal implementation** — only now, write the smallest thing that works
>
> **Never simplify away:** input validation at trust boundaries, error handling
> that prevents data loss, security measures, accessibility, or anything the
> acceptance criteria explicitly asked for. Lazy is not negligent.
>
> **Tests:** non-trivial logic requires at least one minimal runnable check
> (`assert`, `demo()`, or a single small test). Trivial code gets none. The
> locked Verification-command must pass. Write nothing beyond that.
>
> **No speculative abstractions** — no interface, factory, or config for a
> single call site. Fix root causes in shared code, not symptoms in callers.
> Prefer the compact diff and the fewest files.
>
> Mark deliberate trade-offs with a `ship:` comment naming the upgrade path.
> Report as: `[what you built] → skipped: [X], add when [Y].`

The ladder is adapted from [ponytail](https://github.com/DietrichGebert/ponytail)
(MIT, DietrichGebert). Interactive sessions can invoke the plugin directly;
this copy exists because worktree subagents may not load plugins.

## Batch input

`MAX_BATCH` defaults to 4 and is capped at 8. `ship` marks all selected ids
`in-progress` atomically before invoking this skill. The CLI manifest is one
line per item:

```text
<id>|<branch>|<model>|<task prompt>
```

The task carries the plan/item path, exact acceptance criteria, the locked
Verification-command, MAIN_BRANCH, the absolute worktree path, and the ladder
above. Set `TEST_CMDS_JSON` to a complete JSON map from id to its locked
command; `TEST_CMD` is only accepted for a one-item batch. Reject any manifest
model other than the fixed contributor pin.

## CLI path

When `OPENCODE_BIN`, `~/.opencode/bin/opencode`, or `opencode` on `PATH` is
available, run:

```bash
ship-parallel/scripts/parallel.sh <repo-root> <worktree-root> <manifest>
```

The runner creates worktrees and launches one
`opencode run --dir <worktree> --model <model>` process per item concurrently.
CLI cannot directly select a `mode: subagent` agent, so each process uses the
built-in Build primary with an injected `task: deny` permission; reviewer
processes additionally receive `edit: deny`. It waits for committed worker
results, runs the locked command, then launches the reviewer for green items
only, in a disposable detached review worktree so shell activity cannot alter
the contributor branch. Full output goes to `.log` files; only result contracts
return to `ship`.

## In-session fallback

If no OpenCode binary exists, `ship` creates every worktree, then sends one
tool message containing one `contributor` task call per item. Each worker is
told to operate only inside its absolute worktree, build to the ladder, run the
locked command, and commit.

After workers finish, `ship` runs each locked command itself. It then sends one
message containing one reviewer task call per **green** item, passing the
command's verbatim evidence to a shell-disabled, edit-disabled reviewer. The
fallback emits the same JSON contract as the CLI path.

## Review and merge rules

- **Gate first.** Run the locked Verification-command before spending a model.
  A red gate is a failure on its own — report it and move on. Nothing to review.
- **One reviewer per green item**, drawn from `council-grok` or `council-kimi`,
  never the contributor's model. No verdict means no merge.
- Review items separately, never as a batch.
- Any evidenced P0/P1 blocks even if the reviewer mistakenly prints `PASS`.
- **Over-build is a finding.** A reviewer that sees a speculative abstraction, a
  new dependency where the stdlib sufficed, or tests beyond the runnable-check
  rule reports it as P2 with `file:line`.
- `HARDENED=1` adds one read-only `council-adversary` pass on top.
- Partial success is default: merge green/PASS peers and report failed ids.
- `STRICT_BATCH=1` integrates on a temporary branch and fast-forwards
  MAIN_BRANCH only when the whole batch succeeds, so a late failure cannot
  leave earlier peers merged.
- `ship` alone integrates. Workers commit only their item branch; reviewers do
  not edit; no child updates the backlog or issue labels.

Each reviewer emits:

```text
VERDICT: PASS | FAIL
FINDINGS: [{"severity":"P0|P1|P2|P3","file":"path:line","trigger":"...","wrong_behavior":"..."}]
FOLLOWUPS: []
```

For overlap, begin a no-commit merge. Keep both unique non-overlapping hunks.
For the same hunk, prefer the incoming branch only inside its declared
`files_touched`; otherwise prefer HEAD. Remove markers and run `TEST_CMD`. If
still red, `git merge --abort`, mark that item failed, and continue the wave.
After a resolver edits the integration, materialize an immutable candidate
commit and rerun the review in a separate detached worktree before committing
the same tree.

## Results contract

Every batch atomically writes:

```json
{"main_branch":"...","merged":[{"name":"...","branch":"...","sha":"...","verdict":"PASS"}],"blocked":[],"failed":[],"conflicts":[]}
```

Every item writes a compact one-line `<id>.digest.json`:

```json
{"id":"...","verdict":"PASS|FAIL","files_touched":[],"tests":{"pass":0,"fail":0,"cmd":"..."},"findings":[],"followups":[]}
```

`ship` ingests only these files, never logs. `results.json`, digests, branch
ancestry, and Git are producer truth for Phase R.
