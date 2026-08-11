# skills

Agent skills for running software work as a **factory** rather than a conversation — plus `vskills`, a zero-dependency installer that puts them on your machine.

A skill is a file an agent loads on demand that says *how to do one job properly*. This repo holds an autonomous goals pipeline, its council and worktree machinery, a preserved legacy four-stage workflow, and standalone skills for the jobs around them.

```
npx github:VrajGupta/skills init
```

---

## Why not just prompt?

You already can prompt an agent to "build this feature and test it." It usually works. The failures are the problem — and they are the *same* failures every time.

| What goes wrong when you prompt | Why it happens | What a skill does instead |
|---|---|---|
| Agent says "done", the tests were never run | "Done" is a feeling, judged by the same model that wants to be finished | Done is a **locked command that must exit 0**, run *after* the final edit |
| Agent reviews its own code and approves it | The misreading that produced the bug produces a confident review of the bug | The reviewer is a **different model in a different context**, and never reads the author's rationale |
| A ticket bounces between build and fix forever | Nobody is allowed to say "this ticket is unbuildable" | Three failed reviews **escalate to a human** instead of looping |
| Second session has no idea what the first did | Chat history is not a handoff | Resume from **backlog + handoff + producer digests + git**, never chat |
| Parallel agents overwrite each other | They share one checkout | One item gets one **branch + worktree**, so edits cannot collide by construction |
| "I fixed the edge cases" (it did not) | Happy path is green, so the suite says yes | Two per-item reviewers plus milestone and whole-diff gates attack the claim |

The thread running through all of it: **a claim is not evidence.** Nearly every rule in this repo exists to convert some claim into something checkable.

<details>
<summary><b>The single most important idea, if you read nothing else</b></summary>

<br>

**Maker ≠ checker, structurally.**

Not "the agent should double-check its work" — that fails, because the same context that made the mistake evaluates the mistake. Instead:

- The fixed **GLM contributor** builds in an isolated worktree and cannot judge its own code.
- Two different-model **council members** review each item before merge.
- A rotating milestone reviewer checks integration only, and a read-only adversary tears down the final cumulative diff before completion.

Everything else is plumbing around that one property.

</details>

---

## The pipeline

```mermaid
flowchart LR
    Plan[Plan doc] --> B[Phase B backlog sanity]
    B --> Loop[Ready items]
    Loop --> P[Parallel worktrees]
    P --> T0[2x T0 item review]
    T0 --> M[Merge passing items]
    M --> T1[T1 milestone gate]
    T1 -->|next milestone| Loop
    T1 --> T2[T2 success-criteria sweep]
    T2 --> T3[T3 adversary]
    T3 --> Done[Verified complete]

    style Done fill:#1a7f37,color:#fff
```

`/goal CONTEXT/architecture.md` starts one long-lived, resumable primary. It is
the only writer of `backlog.jsonl` and the only process that merges branches or
mirrors state to GitHub issue labels.

| Mechanism | Owns |
|---|---|
| `goals` | Phase R resume, 3-7 thematic milestones, backlog, checkpoints, T1/T2/T3 |
| `parallel` | Up to three ready code items in isolated worktrees, fixed GLM contributor, T0, merge/results contract |
| `council` | Independent research, evidence debate, Phase B sanity, T0/T1 reviews |
| `council-adversary` | Read-only optional T0/T2 teardown and mandatory T3 whole-diff verdict |

### Resume is state, not memory

Every fresh goals session runs Phase R first. `backlog.jsonl` means resume,
never reparse. It acquires `lock.d`, reads the slim handoff, reconciles stale
work from `results.json`, item digests, and branch ancestry, recomputes ready,
and continues. Raw model logs never enter orchestrator context.

### Handoff is not delivery

The productivity `/handoff` skill only compacts and redacts conversation context
to the OS temporary directory. `goals` separately owns the durable
`CONTEXT/goals/<slug>/handoff.md` resume cursor. `/push-handoff` is the explicit
delivery operation: it verifies, commits, pushes, and proves the fetched remote
SHA. When both are needed, run `/handoff` then `/push-handoff`; creating a
handoff never authorizes or implies a push.

### Council is independent

The configured council is Grok 4.5, Kimi K3, Qwen 3.8 Max, GPT-5.6 Sol, and
GLM 5.2, plus the active primary's independent pass. Round 1 gives every member the full
task verbatim in one parallel spawn. Later rounds give each member the other
reports and a neutral conflict index. Evidence resolves disagreements; a vote
is only the three-round fallback. Phase B is the one exception: exactly two
members, one round, no debate or vote.

### Parallel is the workhorse

Each item gets `goals/<slug>/<id>` and its own worktree. GLM 5.2 builds
test-first and commits there. Grok and Kimi independently review that one diff;
no verdict means no merge. Green peers merge even when another item fails,
unless `STRICT_BATCH=1`. Goals ingests only compact JSON results and digests.

### Gates get wider

T0 checks one item with two non-maker reviewers. T1 first runs mechanical
integration checks, then one rotating reviewer checks milestone composition
only; the pipeline pauses after a passing T1 for human continuation. T2 sweeps
the whole plan's success criteria. T3 is a mandatory read-only adversarial pass
over the cumulative merged diff. P0/P1 findings must drain before completion.

### Legacy workflow

The previous `/planner -> /coder -> /debugger -> /reviewer` GitHub Projects
pipeline remains available only as `/legacy-planner`, `/legacy-coder`,
`/legacy-debugger`, and `/legacy-reviewer` under `legacy-workflow/`. Its former
`adversarial-loop` mechanism is now `multi-agent-review`.

---

## Built to production standards

This is the discipline you would apply to code that pages you at 3am, applied to the process that writes it. Every claim below is checkable in this repo right now.

| Standard | How it's held |
|---|---|
| **Nothing ships unverified** | Every ticket carries a `Verification-command` that must exit 0, run *after* the final edit — not before, not "probably still passing" |
| **Independent sign-off** | The GLM maker is excluded from T0-T3 judgment; the final adversary is read-only |
| **Non-functionals are contracts** | Acceptance and invariant docs travel into every item, milestone gate, and final teardown |
| **Failures terminate** | Attempts are capped at two per source id; blockers escalate instead of creating recursive retries |
| **State is auditable** | Backlog, handoff, producer digests, branch ancestry, and structured review records reconstruct the run without chat |
| **Concurrency is bounded** | `MAX_BATCH` defaults to 3 and caps at 4; every item gets a separate branch and worktree |
| **Deploys are proven** | `push-handoff` refuses to claim success without reading the remote SHA back, never force-pushes, and scans the diff for secrets |

The tooling holds the same bar. `vskills` ships **zero runtime dependencies** with tests covering install, drift detection, dependency resolution, symlink safety, and the npx entrypoint. Copies stage into a temp dir and swap in via `rename`, so an interrupted install cannot leave a half-written skill. Content is hashed, so a skill you hand-edited is detected as drifted and left alone rather than silently overwritten. Destructive overwrites are backed up first. The guarantees are written down and held to in [`docs/invariants.md`](docs/invariants.md).

<details>
<summary><b>What each mechanism buys, and what it costs</b></summary>

<br>

No mechanism here is free. Each row is the honest trade.

| Mechanism | Failure it removes | Costs you |
|---|---|---|
| Locked `Verification-command` run after the final edit | "Done" claimed on tests that were never run | Nothing — this one is strictly free |
| Blind review on a different model | Self-approved bugs. The single largest win. | A second model's tokens |
| Invariants locked *before* the spec | Plans optimized for "finish" instead of "safe" | One interactive planning session |
| T0 + T1 + T3 widening review | Local and composed defects missed by one scope | Several fresh-model passes |
| Attempt cap → human escalation | Infinite build/fix loops on impossible items | An occasional human interrupt |
| Atomic backlog + producer digests | Session two re-deriving session one | Checkpoint discipline |
| One worktree per item | Agents silently overwriting each other | Worktree lifecycle overhead |

Overall you are trading **tokens and time-to-first-"done"** for **defects that never reach you**. That trade is excellent on a payments integration or an auth boundary, and poor on a script you are deleting tomorrow.

**If you adopt one thing:** lock a verification command before the work starts and require it to be run after the final edit. Most false "done" claims disappear and it costs nothing.

**If you adopt two:** have a *different model* review the diff without reading the author's explanation.

</details>

<details>
<summary><b>When NOT to use this</b></summary>

<br>

Knowing where a tool stops is part of what makes it trustworthy inside its range.

- **Throwaway scripts, spikes, prototypes.** Use `/prototype`. The pipeline's overhead buys nothing when the code is going in the bin.
- **One-line fixes.** A multi-tier goal run for a typo is theater.
- **Exploratory work where you don't know the question yet.** Use `/wayfinder` to map it first, or `/research`. Grilling fog produces confident nonsense.
- **Solo hacking where you *are* the checker and you're actually going to read it.** The pipeline's value is proportional to how little you plan to read.
- **No test suite at all.** The gate is the backbone. Without one, every "done" is a judgment call again and most of the machinery is inert.

</details>

---

## "I want to…" — start here

| I want to… | Use |
|---|---|
| Drive a plan through milestones to verified completion | `/goal CONTEXT/architecture.md` |
| Research a genuinely contested decision | `council` |
| Build several ready items safely | `parallel` through `goals` |
| Tear down a converged diff without fixing it | `council-adversary` |
| Run a blind loop against a real quality bar | `/gauntlet-loop` |
| Run *any* task until a checker says done | `/loop-engineer` |
| Have several models attempt + cross-examine the same task | `/multi-agent-review` |
| Stress-test a plan before building | `/grilling`, `/grill-me` |
| Map work too big to hold in one session | `/wayfinder` |
| Debug something genuinely hard | `/diagnosing-bugs` |
| Audit a whole codebase, not one diff | `/codebase-audit` |
| Check an invariant is *enforced*, not just documented | `/invariant-evidence-review` |
| Work on several tickets at once | `/parallel-subagent-implementation` |
| Deliver a whole ticket range in order | `/subagent-batch-implementation` |
| Ship a webhook / queue / billing integration | `/provider-integration-tdd` |
| Price a feature whose cost is inference | `/ai-subscription-unit-economics` |
| Unstick a pipeline reporting false progress | `/state-driven-pipeline-recovery` |
| Hand off to the next session | `/handoff` then `/push-handoff` |
| Write a skill of my own | `/writing-for-agents` |

---

## Full catalog

<details>
<summary><b>Pipeline machinery</b> — how tickets move and what counts as proof</summary>

<br>

`goals` is the active chain. `council`, `parallel`, and `council-adversary` are the machinery it composes; `pipeline/` contains additional reusable delivery disciplines.

| Skill | Use when |
|---|---|
| `goals` | Sole backlog writer and resumable autonomous plan driver |
| `council` | Independent research/debate and scoped T0/T1 review protocol |
| `parallel` | Worktree build farm, two-reviewer T0 gate, partial-success integration |
| `council-adversary` | Read-only optional T0/T2 and mandatory T3 teardown |
| `github-projects-pipeline` | Legacy/reusable GitHub Projects stage protocol |
| `profile-gated-delivery` | Run an effort end to end with an evidence gate between every stage |
| `specialist-profiles` | Build and verify the four role agents so maker ≠ checker is structural, not aspirational |
| `state-driven-pipeline-recovery` | The pipeline is thrashing, or a worker reports success while nothing changed |
| `controlled-ticket-delivery` | Budget caps, live migrations, restricted git or tracker access |
| `ticket-implementation-tdd` | Detailed one-ticket TDD discipline for standalone or legacy workflows |
| `provider-integration-tdd` | Queues, signed webhooks, idempotent billing, owned artifacts — where failures are replay and ordering, not logic |
| `invariant-evidence-review` | Is this invariant actually enforced and measured, or just asserted in a comment? |
| `codebase-audit` | Audit a whole system: sweep by layer, rank by blast radius, emit tickets |
| `shared-worktree-safety` | Another agent or human is writing to the same checkout |
| `shared-worktree-delegation` | Fanning subagents into one tree with explicit file lanes |
| `parallel-subagent-implementation` | **Start here for any fan-out** — carries the route table for all parallel work |
| `subagent-batch-implementation` | An authorized ticket *range* delivered in dependency waves |
| `ai-subscription-unit-economics` | Pricing and usage caps when inference is your cost of goods |

The load-bearing rule across all of them: **done is a locked verification command that was actually run after the final change**, plus an independent checker for non-trivial work, plus truthful tracker state.

</details>

<details>
<summary><b>Standalone skills</b> — useful with or without the pipeline</summary>

<br>

| Skill | What it's for |
|---|---|
| `loop-engineer` | Wrap any task in a closed maker→checker loop with an explicit done-condition |
| `gauntlet-loop` | Generate or run a blind maker→critic loop against a real quality bar for one-shot, UI, writing, and implementation work |
| `multi-agent-review` | Same task, several model/provider agents in isolated worktrees, relayed cross-critique, final artifacts rated side by side |
| `push-handoff` | Commit and push under explicit authority, and **prove** it by reading the remote SHA back |
| `setup-obsidian` | Turn a docs folder into a retrieval graph — router, generated indexes, state file |
| `setup-vskills` | Set this repo up on a new machine |

`/gauntlet-loop` is the lightweight path for work that does not need the full
planner → coder → debugger → reviewer pipeline. Use it for one-shot prompts, UI
polish, writing, research, or small implementation tasks:

```text
/gauntlet-loop build a landing page for my running brand
```

It first requires a named, fetchable comparison bar. In prompt mode it returns a
paste-ready prompt; in run mode it loops a maker and a fresh critic until the output
wins the blind comparison and its normal verification gate passes. UI work also gets
same-viewport screenshots, responsive states, accessibility, typography, and
interaction checks. It never replaces the debugger or reviewer for security,
permissions, payments, migrations, or other high-risk work.

Install only this skill with:

```bash
npx github:VrajGupta/skills add gauntlet-loop
```

</details>

<details>
<summary><b>mattpocock/</b> — mirrored library, use independently</summary>

<br>

[mattpocock/skills](https://github.com/mattpocock/skills), MIT licensed — see `mattpocock/LICENSE`. Mirrored by his own category structure. Each is independent; invoke whichever fits the moment.

**engineering/** — `tdd` · `code-review` · `diagnosing-bugs` · `codebase-design` · `domain-modeling` · `grill-with-docs` · `implement` · `improve-codebase-architecture` · `prototype` · `research` · `resolving-merge-conflicts` · `to-spec` · `to-tickets` · `triage` · `wayfinder` · `ask-matt`

**productivity/** — `grilling` · `grill-me` · `handoff` · `teach` · `writing-for-agents`

**misc/** — `git-guardrails-claude-code` · `migrate-to-shoehorn` · `scaffold-exercises` · `setup-pre-commit`

**personal/** — `edit-article` · `obsidian-vault`

**in-progress/** and **deprecated/** are mirrored as-is; treat accordingly.

Run `setup-matt-pocock-skills` once per repo before using the engineering skills — it configures the issue tracker, triage labels, and domain-doc layout they assume.

See `mattpocock/UPSTREAM-README.md` for his full reference and the philosophy behind them.

</details>

---

## Installing with `vskills`

```bash
npx github:VrajGupta/skills init               # install every skill
npx github:VrajGupta/skills list               # what's installed / drifted
npx github:VrajGupta/skills add <skill>        # one skill + its dependencies
npx github:VrajGupta/skills update [skill...]  # refresh (skips your local edits)
```

Content is copied to `~/.agents/skills/<name>` and symlinked into `~/.claude/skills/<name>`.

<details>
<summary><b>What it guarantees</b></summary>

<br>

- **Your edits are safe by default.** If an installed skill's content hash doesn't match the manifest, it's `drifted` and left untouched. Only `--force` overwrites it.
- **Destructive overwrites get backed up first**, to `~/.agents/skills/.vskills-backup/<name>-<timestamp>`.
- **Interrupted copies never corrupt.** Staged in a temp dir, swapped in with `rename`.
- **Symlinks are never clobbered.** A real directory or a foreign symlink at the target path is left alone with a warning.

Zero runtime dependencies, Node ≥18. Full design in [`docs/spec-vskills-cli.md`](docs/spec-vskills-cli.md); the guarantees it holds itself to are in [`docs/invariants.md`](docs/invariants.md).

</details>

---

## Layout

```
bin/vskills.js    the vskills CLI entrypoint
src/              vskills implementation
test/             vskills test suite (node --test)

goals/            autonomous plan driver, atomic backlog, milestone gates
council/          independent research, debate, T0/T1 review protocol
parallel/         worktree build farm + CLI runner + compact results contract
council-adversary/read-only T0/T2/T3 teardown
opencode/         canonical global primary/subagent + /goal definitions
legacy-workflow/  preserved legacy-planner/coder/debugger/reviewer skills

push-handoff/     verified, explicitly authorized commit/push closeout
loop-engineer/    closed maker→checker loop runner
gauntlet-loop/    blind maker→critic loop for one-shot and UI work
multi-agent-review/ standalone multi-model worktree comparison loop
pipeline/         the machinery: stage protocol, roles, worktree safety,
                  batch delivery, audit, recovery
mattpocock/       mirrored library (github.com/mattpocock/skills)
```

<details>
<summary><b>Global OpenCode agent profile</b></summary>

<br>

OpenCode loads the canonical definitions under `opencode/agent/` globally from
`~/.config/opencode/agent/`. Shift-Tab can select either `goals` for delivery or
`council` for standalone research/review. Goals remains the only writer and
merger in a goal run. Every child is `mode: subagent` with `task: deny`, so the
tree is always one level:

```text
goals   -> {contributor, council members, council-adversary}
council -> {council members, council-adversary}
```

| Agent | Model |
|---|---|
| `goals` | current selected model, delivery primary |
| `council` | current selected model, read-only primary |
| `contributor` | `opencode-go/glm-5.2` |
| `council-grok` | `opencode-go/grok-4.5` |
| `council-kimi` | `openrouter/moonshotai/kimi-k3` |
| `council-qwen` | `openrouter/qwen/qwen3.8-max` |
| `council-sol` | `openai/gpt-5.6-sol` |
| `council-gemini` | `openrouter/google/gemini-3.6-flash` |
| `council-deepseek` | `openrouter/deepseek/deepseek-v4-flash-0731` |
| `council-glm` | `opencode-go/glm-5.2` (research only for GLM-authored code) |
| `council-adversary` | `opencode-go/grok-4.5`, read-only |

Members have read-only filesystem, web, skill, and inherited MCP access. They
inspect source material themselves instead of receiving a
pre-solved answer. The CLI path launches fresh `opencode run --dir <worktree>`
processes; if no binary exists, goals uses parallel Task calls against the same
worktrees and emits the same result contract.

OpenCode loads configuration once. Quit and restart it after changing an agent,
skill, command, or config file.

</details>
