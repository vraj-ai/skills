---
name: council
version: 1.0.0
description: Run independent multi-model research, evidence-based debate, voting, and scoped T0/T1 reviews without rubber-stamping. Use when goals encounters a genuinely contested research item, Phase B needs backlog sanity checks, an item needs independent T0 reviewers, or a milestone needs one rotating integration reviewer.
---

# Council

Council is a protocol run either by the selectable `council` primary for
standalone work or by the `goals` primary inside a goal run. Members are flat
`task: deny` subagents with read-only filesystem, skill, web, and MCP access.
The configured roster is:

- `council-grok`: `opencode-go/grok-4.5`
- `council-kimi`: `openrouter/moonshotai/kimi-k3`
- `council-qwen`: `openrouter/qwen/qwen3.8-max`
- `council-sol`: `openai/gpt-5.6-sol`
- `council-glm`: `opencode-go/glm-5.2`

The active primary performs its own independent pass alongside all five,
making six perspectives for contested research. Never pre-solve the question
and ask members to ratify an answer.

## Research rounds

### Round 1: independent work

In one tool message, spawn all five members concurrently with the full task
verbatim. Each independently reads real files, cites `file:line`, uses primary
web sources where relevant, cites URLs, and returns a complete evidence-backed
report. Goals performs its own pass before reading member reports. Do not merge
yet.

### Round 2+: debate

Build a neutral conflict index containing only material claims on which reports
disagree. In one tool message, invoke all members again. Give each member the
other reports and conflict index, but not its own report. Require point-by-point
agreement, rebuttal, or concession with evidence.

Rebuild the conflict index after each round. A point remains open only when
members still disagree after seeing the same evidence. Stop when no new
material disagreement remains or after three total rounds.

### Vote and deliverable

If dissent remains at the cap, each member votes on each open point. Majority
wins; goals casts only the evidence-based tie-breaking vote. Produce one clean
converged report with conclusions, actions, and verdicts. Keep member framing,
conflict indexes, and vote tallies in working notes, not the deliverable.

## Sanctioned Phase B exception

For backlog sanity only, invoke exactly `council-grok` and `council-kimi` in
one parallel message for one independent round. No debate and no vote. Require
the fixed checklist:

```text
COVERAGE / DUPLICATES / SCOPING / DEPENDENCIES / FEASIBILITY
```

Goals applies findings mechanically; additive evidence wins. At most one
rerun. Never generalize this shortcut to contested research.

## Review roles

### T0 item review

Exactly two eligible non-maker members independently review one item diff.
Review items separately, never as a batch. The CLI path runs the locked
verification command in each disposable review worktree. In the in-session
fallback, goals runs it mechanically and supplies the evidence to reviewers,
whose shell and editing permissions remain denied. Each emits:

```text
VERDICT: PASS | FAIL
FINDINGS: [{"severity":"P0|P1|P2|P3","file":"path:line","trigger":"...","wrong_behavior":"..."}]
FOLLOWUPS: []
```

Any evidenced P0/P1 fails closed. The reviewer never fixes the item. With the
fixed GLM worker, default T0 reviewers are Grok and Kimi; GLM may research but
must not judge GLM-authored code.

### T1 milestone review

Use one rotating eligible member after mechanical checks pass. Scope is
integration only: whether merged items compose, cross-item coverage gaps, and
drift from the plan. Do not re-review item code quality. Emit `PASS`,
`PASS-WITH-FOLLOWUPS`, or `FAIL`.

Rotation is `council-grok -> council-kimi -> council-qwen -> council-sol`,
never the same member twice in a row and never the maker model.

## Anti-over-engineering guard

Pass this in every invocation and round:

> Default to the lowest-complexity option meeting the strict requirements.
> Prefer existing stack components. Avoid resume-driven architecture,
> microservices, speculative extensibility, and heavy frameworks when the
> standard library suffices. If a heavy option is necessary, state exactly why
> simpler options fail and justify its operational tax.
