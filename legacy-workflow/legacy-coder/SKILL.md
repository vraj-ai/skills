---
name: legacy-coder
version: 1.2.0
description: Legacy coding stage from the former planner-coder-debugger-reviewer fleet, preserved for explicit opt-in use. Use only when the user invokes /legacy-coder or deliberately requests the old GitHub Projects stage workflow instead of goals.
dependencies: [multi-agent-review]
---

# /legacy-coder — Former implementation chain

This is the preserved legacy workflow. The active autonomous pipeline is
`goals`; do not auto-trigger this skill for ordinary implementation requests.

Orchestrate the build-and-hand-off loop: figure out what to work on from the
docs, implement it test-first against a machine-checkable gate, self-check the
obvious corners, then pass it down the line. This is the counterpart to `/legacy-planner`
(which produces the tickets — and the invariants — this skill consumes).

## Your place in the fleet loop

The fleet is a pipeline on the project's board, one skill per stage, each stage
run by a **different model** so that no stage ever reviews its own work:

```
Planned → Agent Ready → Coding → Debugger Ready → Debugging → Review Ready → Reviewing → Done
   └ /legacy-planner ─┘  └──── /legacy-coder ────┘   └──── /legacy-debugger ────┘   └──── /legacy-reviewer ────┘
```

### Stage-parent session

The default coder is Kimi K3 in a separate top-level Pi session through OpenRouter,
with high reasoning. It may use Kimi K2.7 Code helpers only when Kimi K3 is the
independent stage parent. If `/legacy-coder` was launched as a native child of another
session, it must work directly and cannot create nested children. The GitHub
Project item, GitHub issue, git/PR artifacts, and handoff bridge this session to the
other stage parents.

**Your board moves:** claim from **`Agent Ready`** → **`Coding`** before writing
any code → **`Debugger Ready`** when the gate is green. Each move updates the
GitHub Project item's canonical `Status` field and applies to **only the one ticket
you are building**; the rest of `Agent Ready` stays untouched. Read
`~/.claude/skills/github-projects-pipeline/SKILL.md` for the exact `gh project`
mechanics, live field/option IDs, read-back-after-write rule, and the
**no-project fallback**.

**No GitHub Project? The build still runs in full.** Take the next ticket from
the project's local tracker or the newest handoff, build it test-first against the
same gate, self-check the same way, and record where it ended up in the handoff.
Say which mode you're in. A missing label is a bookkeeping gap; a skipped test is
a defect that ships.

You are the **maker**, and deliberately not the checker. `/legacy-debugger` will attack what
you build and `/legacy-reviewer` will judge whether it may close — both on different models,
precisely so they don't inherit your blind spots. That division is the reason to
build honestly rather than defensively: you cannot talk the judge into a pass (it
never reads your handoff), and hiding a stub only wastes a downstream stage's
budget rediscovering it. Your job is a green gate and an honest report of what
isn't finished.

You may also be handed a ticket **bounced back from `/legacy-reviewer`** — routed to Agent
Ready because an acceptance criterion was unimplemented or an invariant had no
covering test. Read the review comment on the ticket first: it names the exact
defect and the bounce count. Fix *that*, not the whole ticket again.

## Step 1 — Read the docs and pick the next ticket

Read, in roughly this order (use whatever the repo actually has):
0. A **retrieval router** (`ROUTER.md` beside the docs), if one exists — it maps
   question → index, so you open two or three files instead of the tree. Its
   `state.md` also carries what the last session left behind.
1. The **newest handoff** doc — it usually records what's already done and names
   the next ticket to start.
2. The project's **glossary / domain docs** — use this vocabulary everywhere.
3. The **tracker / tickets** (`tickets.md` or GitHub issues) — in order; read each
   candidate's **Blocked by** section and **acceptance criteria**.
4. The relevant **spec / plans** and **ADRs** for the ticket's area.

**Selection rule:** pick the **lowest-numbered ticket in Agent Ready whose every
Blocked-by ticket is done.** Prefer a ticket carrying a `/legacy-reviewer` review comment
(a bounce) over a fresh one — bounced work is already half-built and blocking a
close. **Move that one project item to `Coding` before you write any code** —
update the Project `Status` field and read it back — so
the board shows what's in flight. A ticket being worked on while it still reads
`Agent Ready` is invisible, and a second run will claim it and build the same
thing twice. **Move only that ticket:** the rest of the `Agent Ready` queue stays
exactly where it is. Dragging the queue into `Coding` claims work nobody is doing
and hides the one ticket that's actually live. On a real tracker, prefer querying the
frontier (tickets whose blockers are all closed) directly over rebuilding it by
eye. Determine "done" from the newest handoff (what it reports complete) and the
git history. If the latest handoff explicitly names the next ticket, trust that
and verify its blockers are satisfied. If two tickets are equally ready, prefer
the one the spec marks as the critical path. **State which ticket you picked and
why before building.** If nothing is unblocked, say so and stop.

### Draining the queue — "build all of them"

One ticket per run is the default, because thin slices keep handoffs reviewable.
When the user asks for the whole queue ("pick up everything in Agent Ready",
"work through them all"), that is a request to **repeat this skill end-to-end,
serially** — not to claim the queue or build several tickets into one diff. Run
Steps 1–4 to completion on one ticket, land it in `Debugger Ready`, then start
again from Step 1 for the next.

Two habits make this loop reliable:

- **Re-query the board between tickets, never cache the list.** The frontier
  changes as you go: finishing ticket 12 may unblock ticket 15, and `/legacy-reviewer` may
  have bounced something back into `Agent Ready` while you built. Ask the tracker
  again each lap and re-apply the selection rule to fresh data.
- **One ticket in `Coding` at any moment.** Move it in when you start, out when
  the gate is green, and only then claim the next. That column answers "what is an
  agent touching right now"; a batch claim destroys the only question it exists to
  answer.

Stop the loop when nothing is left unblocked, when the user's budget is spent, or
when a ticket blocks hard (gate can't go green within budget, auth failure). Then
report each ticket built and where it landed — one line each. If `Agent Ready` is
empty at the start, say so and stop rather than reaching into `Planned` for work
that hasn't been promoted.

**The authorized exception.** Serial is the default and stays the default. If the
user explicitly authorizes *parallel* work — not just "do them all", but genuinely
"build these at the same time" — read the route table in
`~/.claude/skills/parallel-subagent-implementation/SKILL.md` and follow it. It
holds the preconditions (disjoint lanes proven, no in-batch blockers, baseline
green recorded), the lane brief, and the rule that you re-run every worker's gate
yourself. Nothing in it relaxes this skill: one commit per ticket, one project
item moved per ticket, and you still never set `Done`.

## Step 2 — Lock the gate, then build it test-first

**First, lock the done-condition gate.** Translate the ticket's acceptance criteria
+ the `/legacy-planner` invariants into **one command that must exit 0** — e.g. `npm test --
<ticket>.spec && tsc --noEmit && <lint/design-check>`. If `/legacy-planner` shipped the
ticket with a **Verification-command**, use that. "Done" is this command passing,
not a judgment call. Set an iteration **budget** (default 5); on exhaustion, stop
and report the blocking failure rather than thrashing.

5. **`/multi-agent-review`** (`build` mode, pipeline operating mode) — implement the
   chosen ticket through the orchestrator (this stage-parent session) plus its
   fixed default trio, each independently satisfying the ticket's acceptance
   criteria test-first (`~/.claude/skills/tdd/SKILL.md` red-green discipline,
   external dependencies **faked**, no vendor SDK internals or render details)
   in its own isolated worktree, against the same locked gate above. Relay
   rounds until unanimous sign-off or the 6-round cap, then auto-pick the
   highest-rated diff — that diff, merged into this ticket's branch, is the
   implementation. Respect the glossary + ADRs in every worktree; no
   participant may fork or duplicate domain logic. **Refactoring is not part
   of this step** — it's handled by Step 3's `/code-review` pass, so keep
   every participant's loop to red→green only. Log every participant's rating
   in the handoff (Step 4), not just the winner's — a bounce three stages
   later needs to know what the losing attempts got wrong too.

## Step 3 — Self-check, then hand the ticket down the line

6. **Self-check (cheap, scoped — not a full red-team).** The deep adversarial
   pass belongs to `/legacy-debugger` and the verdict belongs to `/legacy-reviewer`, both on different
   models. Duplicating that work here wastes your budget on findings a fresh pair
   of eyes will make anyway, and — worse — a checker running in your own context
   inherits your blind spots and issues a confident all-clear. So keep this pass
   narrow and mechanical, covering only what's embarrassing to pass downstream:
   - **Every acceptance criterion, enumerated.** Walk them one at a time and name
     the line of code and the test that satisfies each. Missing one is the single
     most common reason `/legacy-reviewer` bounces a ticket back to you.
   - **Every named invariant has a test that would go red if it broke.** Not "the
     suite is green" — a specific test per invariant. An invariant with no
     covering test is an unfinished ticket, not a follow-up.
   - **The obvious corners** for what you touched: empty/null input, the external
     dependency erroring, the second identical call (idempotency). One test each.
   - **The gate is green** — the Step 2 command exits 0, suite and typecheck and
     lint included.

   Fix what this finds **test-first**, and re-run the gate after each fix so a
   corner-fix can't silently regress a neighbor. Do **not** start refactoring —
   `/legacy-debugger` owns that pass, and a refactor riding along inside a feature diff
   makes the diff harder for it to review.

7. **Move the project item to `Debugger Ready`** — update and read back the
   Project `Status` field. This is what "done building" means at this stage — not
   `Done`, and not a judgment call you get to make. Leaving it in `Coding` after
   you finish is the same bug as never moving it there: the column stops meaning
   "an agent is on this right now." If something is
   genuinely stubbed, in-memory, or unwired, it still moves, but say so plainly in
   the handoff. Hiding it doesn't get it past the next stage; it just makes the
   next stage spend its budget finding out.

## Step 4 — Hand off and push (both required)

8. **`handoff`** — write a handoff doc (project's usual location + the `$TMPDIR`
   copy): what was built, which ticket it moved to Debugger Ready, the green-gate
   state, **what the self-check covered and what it found**, honest follow-ups
   (anything stubbed/in-memory/not-yet-wired), and the **next** ready ticket.
   Write this for the *human* and for `/legacy-debugger` — `/legacy-reviewer` will never read it, by
   design, so nothing here can substitute for a criterion actually being met.
9. **`push-handoff`** — **always run this last.** Read and follow the
   **`push-handoff`** skill (`~/.claude/skills/push-handoff/SKILL.md`): stage the
   handoff doc + all changed code/CONTEXT artifacts, commit, and push to the
   configured remote. **`/legacy-coder` is not complete until push succeeds** (or you
   report an auth blocker with the skill's recovery steps). Never commit secrets.

## Rules

- Run the skills **sequentially**; finish each before the next — **build →
  self-check → move to Debugger Ready → `handoff` → `push-handoff`**, every time.
- **Move the project item**: `Agent Ready` → `Coding` when you start →
  `Debugger Ready` when the gate is green, updating the Project `Status` and
  reading it back every time. The project is the fleet's shared memory; work that
  does not move on it is invisible to the next stage. See
  `~/.claude/skills/github-projects-pipeline/SKILL.md`.
- **One ticket moves, not the queue.** Only the ticket you're actually building
  enters `Coding`; everything else stays idle where it is.
- **You never mark anything Done.** Only `/legacy-reviewer` closes tickets. A green suite is
  evidence, not a verdict.
- **Don't red-team or refactor your own diff.** Those passes belong to `/legacy-debugger`
  and `/legacy-reviewer`, on other models, for a reason — a checker in your context shares
  your blind spots. Keep the Step 3 self-check narrow.
- Implement **one ticket per run** unless the user asks for more — thin slices
  keep handoffs clean and reviewable. When they do ask for more, drain the queue
  **serially**: full skill per ticket, re-query the board between laps, never more
  than one ticket in `Coding` at a time. Only an explicit authorization to work in
  *parallel* opens `parallel-subagent-implementation`, and its preconditions still
  have to hold.
- Be honest in the handoff about partial work **and unfixed edge cases**, so the
  next session knows the true state.
- Defer project-specific conventions to the sub-skills; keep this orchestrator
  project-agnostic.
- End with a short summary: the ticket built and **the state you moved it to**,
  the gate result, the self-check findings, follow-ups, the **pushed commit
  hash**, and the remote branch — omitting the state move or the push means the
  run failed.
