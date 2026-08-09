---
name: legacy-planner
version: 1.1.0
description: Legacy planning stage from the former planner-coder-debugger-reviewer fleet, preserved for explicit opt-in use. Use only when the user invokes /legacy-planner or deliberately requests the old GitHub Projects stage workflow instead of goals.
dependencies: [multi-agent-review]
---

# /legacy-planner — Former planning chain

This is the preserved legacy workflow. The active autonomous pipeline is
`goals`; do not auto-trigger this skill for ordinary planning requests.

Orchestrate the planning skills **in order**, carrying context forward through
each, with an explicit invariants gate before the spec. This is the repeatable
"plan the next effort and hand it off" loop. Do **not** write any application code
in this skill — it produces planning artifacts only.

## Your place in the fleet loop

The fleet is a pipeline on the project's board, one skill per stage, each stage
run by a **different model** so that no stage ever reviews its own work:

```
Planned → Agent Ready → Coding → Debugger Ready → Debugging → Review Ready → Reviewing → Done
   └ /legacy-planner ─┘  └──── /legacy-coder ────┘   └──── /legacy-debugger ────┘   └──── /legacy-reviewer ────┘
```

### Stage-parent session

The default planner is Opus 5 in the Claude Code harness using the Claude
subscription. GPT-5.6 Luna may dispatch it as a headless child after all planning
decisions are supplied, or the human may run it in a visible Claude Code session.
Because the grill is interactive, a headless child cannot ask the user. `/legacy-planner` may
use one-level helpers only when it is the independent top-level stage parent; a
native child launched from another session must not spawn nested children.

**Your board moves:** create GitHub issues in the project's **`Planned`** Status,
then move each project item to **`Agent Ready`** the moment its blockers are
satisfied. The GitHub Project item's `Status` field is canonical; labels are
metadata only. Read `~/.claude/skills/github-projects-pipeline/SKILL.md` for the
exact `gh project` mechanics, live field/option IDs, read-back-after-write rule,
and **no-project fallback**.

**No GitHub Project? The chain still runs in full.** The project is where state is
recorded, not what makes planning correct. With no project available, grill, lock
invariants, and write tickets into the project's local tracker (`tickets.md`) or
the handoff; say which mode you're in. Never skip planning work because a project
field could not be written.

`/legacy-planner` **opens** the loop. Everything downstream — the gate `/legacy-coder` builds
against, the invariants `/legacy-debugger` attacks, the criteria `/legacy-reviewer` reviews — comes
from the tickets you write here. A vague ticket doesn't fail at planning time; it
fails three stages later as a ticket that bounces forever because no one can tell
whether it's satisfied. Write for those three readers.

`/legacy-reviewer` can also send work **back** here: a ticket it judges unbuildable (contra-
dictory criteria, no runnable `Verification-command`, an unsatisfiable invariant)
returns to **Planned** with its reason. When you pick up such a ticket, repair the
ticket itself — re-grill the ambiguous decision if you must — and return it to
**Agent Ready**. Don't just re-word it and send it back into the loop unchanged.

### Draining the queue — repairing bounced tickets

Planning an effort is one run. But `/legacy-reviewer` also routes unbuildable tickets back
to **`Planned`**, and those form a queue you can drain: if the user asks you to
fix the bounced tickets, handle them **one at a time** — repair the ticket, return
it to `Agent Ready`, then re-query the board and take the next. Re-query rather
than caching, since a reviewer may add to that queue while you work. Report each
ticket and its new state, one line each.

## Before you start

Confirm what effort you're planning. If the user named it (a feature, an ADR, a
spec, a one-shot prompt), use that as the subject. If not, ask one question:
"What effort am I grilling?" Then read the project's existing planning docs
(whatever the repo uses — e.g. a glossary/`CONTEXT.md`, the newest handoff,
related plans and ADRs) so the grill is grounded in current decisions.

**If the repo has a retrieval router** (`ROUTER.md` beside its docs), read it
first and let it route you to the right index — score candidates from index
lines before opening anything. Reading the whole docs tree when a router exists
burns the context you need for the grill itself.

## Step 0 — Size the effort (the `/wayfinder` gate)

Before grilling anything, decide **whether this effort is even grillable yet.**
`grill-with-docs` assumes you already know roughly what the questions are — it
interviews to *resolve* open decisions on a single effort that fits in one
planning session. `/wayfinder` operates one level up: it's for a chunk of work
too big to hold in a single agent session, where you don't yet know the
questions, so it maps the territory into a burn-down list of investigation
tickets on the issue tracker and resolves them until the path to the goal is
clear.

Look at the effort you just confirmed and the docs you just read, then judge:

- **Grillable now → skip wayfinder, go straight to the chain.** The effort is one
  coherent feature/ADR/spec, the open decisions are *nameable* (you could list the
  forks the grill needs to settle), and the whole thing plausibly fits in one
  planning + build pass. This is the common case. Proceed to step 1.
- **Too big / too foggy → recommend `/wayfinder` first.** Any of: it spans several
  features or subsystems; you can't yet enumerate the open questions (the unknowns
  are unknown); it obviously exceeds one agent session; or grilling would just
  surface "we need to go investigate X, Y, Z first" instead of decisions. Here the
  honest move is **not** to force a grill on fog. Tell the user plainly:

  > "This looks bigger than one grilling session — I'd run `/wayfinder` first to
  > map it into investigation tickets, resolve those until the path is clear, then
  > run `/legacy-planner` on each resulting chunk. Want me to do that instead?"

  Say *why* (which of the above signals tripped). If the user agrees, hand off to
  `/wayfinder` and stop the chain here — you'll re-enter `/legacy-planner` per resolved
  chunk once the map exists. If the user would rather grill anyway (e.g. they only
  want to plan one slice of it now), narrow the subject to that slice and continue.

Don't over-trigger this gate: a normal next-feature effort with nameable open
questions should go straight to grilling. `/wayfinder` is for genuine mountains,
not for ordinary uncertainty that a grill is built to resolve. When it's a close
call, ask the user rather than silently picking.

## The chain (run each to completion, then pass its output to the next)

1. **`grill-with-docs`** — interview the user to resolve every open decision for
   the effort, challenging against the project's documented language and prior
   decisions. Update those docs inline as terms/decisions resolve. This step is
   **interactive** — finish it only when the load-bearing forks are all decided.
   Carry the locked decisions forward.
2. **Lock invariants** — **before** synthesizing the PRD, make the non-functional
   constraints explicit and write them into the project's docs as named, testable
   invariants. At minimum cover three categories:
   - **Latency / performance budgets** — concrete numbers (e.g. p95 < 300ms, cold
     start < 2s, payload < N KB), not "fast."
   - **Failure modes** — for each external dependency, what happens when it's down,
     slow, rate-limited, or returns garbage; what the user sees; what's retried vs.
     surfaced vs. degraded.
   - **Security / permission boundaries** — authz rules, trust edges, what data is
     exposed to whom, and the blast radius if a boundary is crossed.
   This is the "adult in the room" step: without it the plan optimizes for "finish,"
   not "safe." Carry these invariants forward so the `/multi-agent-review` plan step
   below honors them and so **`/legacy-debugger`'s red-team pass has concrete targets to
   attack** and so `/legacy-reviewer` has something falsifiable to review against.
3. **`/multi-agent-review`** (`plan` mode, pipeline operating mode) — the
   orchestrator (this stage-parent session) plus its fixed default trio each,
   independently in their own worktree, turn the grilled decisions **and the
   locked invariants** into a spec (invariants stated as explicit acceptance
   constraints, not left implicit) and a dependency-ordered vertical
   tracer-bullet ticket breakdown, continuing the project's existing
   numbering/tracker. Do **not** re-interview — this step composes what
   grilling already decided, it doesn't reopen it. Each invariant-touching
   ticket restates the relevant budget/failure-mode/boundary in its acceptance
   criteria. **Each ticket must also ship a machine-checkable done-condition —
   a `Verification-command`** (e.g. `npm test -- <ticket>.spec && tsc
   --noEmit`) that exits 0 exactly when the ticket is complete — so `/legacy-coder`
   has a concrete gate to loop its `/multi-agent-review` `build`-mode pass
   against instead of judging "done" by eye.

   Relay rounds until unanimous sign-off or the 6-round cap, then auto-pick
   the highest-rated spec + ticket set. Rate on: invariants honored
   explicitly, dependency order sound, and **acceptance criteria a blind
   reviewer can check** — `/legacy-reviewer` judges a ticket's diff *without* reading
   the author's handoff or rationale, so each criterion must be checkable from
   code and tests alone. "Handles errors gracefully" gives the reviewer
   nothing to verify and guarantees a bounce; "on provider 5xx, retries twice
   then marks the Brief `failed` with reason `provider_unavailable`" is
   checkable. One observable behavior per criterion — no compound "and"s that
   can be half-satisfied and argued about. Log every participant's rating in
   the handoff (Step 5), not just the winner's.
4. **Publish** — take the winning worktree's spec and tickets. Quiz the user on
   the breakdown, then publish each ticket with What-to-build /
   Acceptance-criteria / **Verification-command** / Blocked-by, then add it to
   the GitHub Project in **`Planned`** and move it to **`Agent Ready`** if
   every `Blocked by` ticket is already done. Set the Project `Status` field
   through `gh project`, then read the item back. A ticket with unsatisfied
   blockers **stays in `Planned`**; that queue is exactly the set of work that
   isn't claimable yet, and putting blocked tickets in `Agent Ready` makes
   `/legacy-coder` pick up work it can't finish.
   **On GitHub Projects, publish for real, always** — creating a local ticket file
   is not publishing. Create each GitHub issue, add it to the configured project, set
   its Project `Status` to `Planned` or `Agent Ready` after checking blockers, and
   use a native blocking/sub-issue link where the repository supports it. For every
   slice, run `gh issue create --body-file <the ticket file>`, then
   `gh project item-add <project-number> --owner <project-owner> --url <issue-url>`
   and update the live `Status` field IDs described by `github-projects-pipeline`.
   On a **local-file tracker**, append each ticket to `tickets.md` with its
   "Blocked by" edge written as text, in dependency order, so the team can work it
   top-to-bottom by hand. Tickets that live only as unpublished on-disk drafts are
   **not** done; the run must report the created ticket numbers/URLs (or the
   `tickets.md` location, for the local-file case). If `gh` is unauthenticated or
   lacks the `project` scope on a GitHub Project, surface that as a blocker with
   the fixes (`gh auth login` / `gh auth refresh -s project`) — do not silently
   fall back to local-only.
5. **`handoff`** — compact this session into a handoff doc (in the project's usual
   handoff location, plus the skill's `$TMPDIR` copy) as a pointer map: the locked
   decisions, **the invariants**, the slice order, and "next agent starts at ticket NN".
6. **`push-handoff`** — **always run this last.** Read and follow the
   **`push-handoff`** skill (`~/.claude/skills/push-handoff/SKILL.md`): stage the
   handoff doc + all planning artifacts (spec, tickets, CONTEXT updates), commit,
   and push to the configured remote. **`/legacy-planner` is not complete until push
   succeeds** (or you report an auth blocker with the skill's recovery steps).
   Never commit secrets.

## Rules

- **Do the sizing gate (step 0) first.** Don't grill fog: if the effort is too big
  or too foggy to name its open questions, recommend `/wayfinder` before the chain
  and stop, rather than forcing `grill-with-docs` on work it can't resolve.
- Run the skills **sequentially**; let each finish before starting the next —
  **`handoff` then `push-handoff`**, every time.
- Pass real context between steps — the spec reflects the grill **and the
  invariants**, the tickets reflect the spec, the handoff points at the tickets.
- **Don't skip the invariants gate.** If the grill couldn't pin down a latency
  budget, failure mode, or security boundary, that's an open decision — resolve it
  with the user before Step 3's `/multi-agent-review` plan run, don't let the spec
  paper over it.
- Stop and surface to the user if grilling reveals the effort needs a new ADR, or
  if the ticket granularity isn't approved at Step 4 — don't push half-baked
  artifacts.
- **Plan for `/legacy-coder`'s gated loop.** Every ticket ships a runnable
  `Verification-command` (its machine-checkable done-condition) so `/legacy-coder` can
  loop maker→checker against a real gate, not a judgment call. A ticket with no
  runnable done-condition isn't ready — resolve it before publishing.
- Defer project-specific conventions (tracker format, repo, labels, doc paths) to
  the sub-skills, which already know them — keep this orchestrator project-agnostic.
- **Tickets land on the real tracker, not just on disk.** On a GitHub Projects
  project, Step 4's publish is not complete until every slice exists as a real GitHub
  issue, is added to the project, and has a read-back-confirmed Project `Status`,
  with native Blocked-by links where supported; a local
  markdown mirror alone does not count as published. On a local-file-tracker
  project, `tickets.md` **is** the tracker, so writing it there is publishing.
- **State lives in one place** — the GitHub Project item's `Status` field. Labels
  are metadata, not a second state machine. Move the project item and read it back
  through `~/.claude/skills/github-projects-pipeline/SKILL.md`.
- End with a short summary: the spec location, the **ticket numbers/URLs (or
  `tickets.md` location)**, **which tickets landed in `Planned` vs `Agent Ready`**,
  the **pushed commit hash**, and the remote branch — omitting the tickets, their
  states, or the push means the run failed.
