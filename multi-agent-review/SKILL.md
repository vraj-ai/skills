---
name: multi-agent-review
version: 1.0.0
description: Run one task through several model/provider agents in isolated worktrees, relay cross-critiques, and compare the final artifacts. Use when the user invokes /multi-agent-review, wants competing implementations/plans/fixes, or explicitly runs the preserved legacy fleet's multi-model mechanism.
---

# Multi-Agent Review

Same task, several models, no one merges anyone else's work. Every participant
works in its own worktree; the orchestrator only relays and, at the end, rates.

This skill is invoked two ways: **directly** by a human (interactive operating
mode), or by the preserved `legacy-coder`, `legacy-debugger`, and
`legacy-planner` workflow. The round mechanics (Steps 2-4) are
identical either way — only how participants are picked (Step 1) and how the
result is resolved (Step 5) differ.

## Mode — what "the task" actually is

| Mode | Used by | Task | Artifact |
|---|---|---|---|
| `build` (default) | `/legacy-coder` Step 2 | Implement the ticket's acceptance criteria test-first | A code diff, gated by the ticket's `Verification-command` |
| `harden` | `/legacy-debugger` Steps 1-2 | Run the four-nets audit + red-team pass against the ticket's landed diff, fix everything found, test-first | A fix diff on top of the existing branch, same gate |
| `plan` | `/legacy-planner` chain steps 3-4 | Turn the already-**grilled** decisions + locked invariants into a spec and dependency-ordered tickets | A spec + ticket set per participant, no code gate |

`plan` mode never runs the interactive grill itself (`grill-with-docs` stays a
single human conversation — you can't parallelize asking the user a question).
It starts only after `/legacy-planner`'s Step 1 (grill) and Step 2 (lock invariants)
are already done; participants compete on turning those locked decisions into
a spec/tickets, not on what the decisions should be.

## Operating mode — interactive vs pipeline

- **Interactive** (default when a human runs `/multi-agent-review` directly):
  Step 1 asks the user, via `AskUserQuestion`, which model/provider fills each
  of the 3 slots, every run. Step 5 presents every final result side by side,
  rated, and asks the user which to keep.
- **Pipeline** (used when `/legacy-coder`/`/legacy-debugger`/`/legacy-planner` invoke this as their
  own step, e.g. while draining a ticket queue unattended): Step 1 uses a
  **fixed default trio** instead of asking — the first 3 distinct models, in
  this priority order, that are not the current orchestrator's own model:
  `Kimi K3, GLM 5.2, GPT-5.6 Sol, Grok 4.5, Fable 5, Opus 5, Sonnet 5`. Step 5
  **auto-picks the highest-rated result** instead of asking, and writes the
  full rating table + rationale into that stage's handoff so the human can
  review or override after the fact, same as any other pipeline output.

State which operating mode you're in before Step 1.

## Step 0 — Decide the orchestrator's role

Check the current session's model against this tier list (edit it here when
new models ship — this is the one place to update):

- **Good tier** (also attempts the task, becomes a 4th participant): Sonnet 5,
  Opus 5, Fable 5, GPT-5.6 Sol, Kimi K3, GLM 5.2, Grok 4.5.
- **Not-good tier** (pure orchestrator, no attempt of its own — 3 participants
  total): Haiku 4.5, GPT-5.6 Luna, DeepSeek V4 (Flash or full), Gemini 3 Pro,
  Qwen3 Max, MiniMax M2, and **anything not on the good-tier list** (unknown
  models default here).

In pipeline mode, the orchestrator is that stage's own model (e.g. Kimi K3 for
`/legacy-coder`, GPT-5.6 Luna for `/legacy-debugger`, Opus 5 for `/legacy-planner` per this repo's
`CONTEXT.md` profile) — check it against the same list.

## Step 1 — Pick the 3 subagent slots

Interactive mode: ask via `AskUserQuestion`, per Operating mode above.
Pipeline mode: use the fixed default trio, per Operating mode above.

For each chosen model, decide how it will actually run:

- **Claude family** (sonnet/opus/haiku/fable) → the native `Agent` tool.
- **Anything else** (Kimi, GLM, GPT, Grok, DeepSeek, Gemini, Qwen, MiniMax...)
  → a headless/non-interactive invocation of whatever CLI the current harness
  has wired to that provider (e.g. `codex exec`, a Pi/OpenRouter run command),
  driven with `Bash`, `cd`'d into that participant's worktree. Check the CLI is
  present and authenticated before Step 2; if it isn't, in interactive mode
  tell the user and ask them to swap the model; in pipeline mode, drop to the
  next model in the default-trio priority list and note the substitution in
  the handoff — don't silently run with fewer than 3 participants.

## Step 2 — Set up isolated worktrees

One worktree per participant, including the orchestrator's own attempt when it
has one — every entrant needs to be symmetric so the final results are fairly
comparable. See `superpowers:using-git-worktrees` for the mechanics; branch
  names like `multi-agent-review/<slot>-<model-slug>` off the current HEAD (in
`harden` mode, off the ticket's already-landed branch, not a fresh one).

## Step 3 — Round 1: independent attempts

Give every participant the identical task brief for the active Mode (see the
table above). Each works alone in its own worktree and produces its artifact.
Every brief must say, explicitly:

```
NO SUBAGENTS — you may not call Agent, Workflow, or spawn any other agent.
If you cannot finish without delegating, stop and report your progress,
blockers, and recommended next step instead.
```

(This mirrors the standing depth-1 rule: the orchestrator is the only one
allowed to fan out.)

## Step 4 — Relay rounds (hub-and-spoke, up to 6 total)

For each subsequent round, every participant receives:

- The original task.
- Every *other* participant's current artifact.
- Every other participant's critique from the prior round.

In `harden` mode specifically, this is where the payoff is: a bug one
participant's audit found and another's didn't gets surfaced and fixed
everywhere, raising every entrant's floor, not just cross-examining one
already-known fix.

Each participant returns: its revised artifact (or "unchanged"), a critique of
the others, and an explicit `SIGN-OFF: yes` / `SIGN-OFF: no — <reason>` line.

Stop as soon as every active participant signs off in the same round, or after
round 6, whichever comes first. Round 6 ending without unanimity is not a
failure — report it as an open disagreement, not a forced consensus.

## Step 5 — Resolve

For each participant, the orchestrator produces: its final artifact summary
(files touched / spec+tickets produced, plain-language), a rating + rationale
(the orchestrator rates every entry itself, including its own attempt if it
has one — no separate judge pass), and its final sign-off status.

- **Interactive mode**: present all of this side by side, no merge, no
  auto-picked winner. Ask the user which to keep. The chosen branch still
  needs to be merged/cherry-picked by hand.
- **Pipeline mode**: auto-pick the highest-rated result. Merge/cherry-pick it
  into the calling stage's working branch. Write the full rating table +
  rationale for every participant (not just the winner) into that stage's
  handoff, so a human reviewing the pipeline's output later can see what lost
  and why.

## Cleanup

Once resolved (by the user in interactive mode, automatically in pipeline
mode), remove the losing worktrees (`git worktree remove`) unless the user
asked to keep them for reference.

## Related

`shared-worktree-delegation` (lane/gatekeeper mechanics this borrows from),
`superpowers:using-git-worktrees` (worktree setup), `push-handoff` (once the
chosen diff is merged and ready to ship), `grilling` (for scoping the task
brief itself before a run, if it's still fuzzy), `legacy-coder`,
`legacy-debugger`, and `legacy-planner` (the preserved stages that invoke this
in pipeline mode).
