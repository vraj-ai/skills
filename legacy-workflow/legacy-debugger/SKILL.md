---
name: legacy-debugger
version: 1.2.0
description: Legacy debugging stage from the former planner-coder-debugger-reviewer fleet, preserved for explicit opt-in use. Use only when the user invokes /legacy-debugger or deliberately requests the old GitHub Projects stage workflow instead of goals.
dependencies: [multi-agent-review]
---

# /legacy-debugger — Former debugging chain

This is the preserved legacy workflow. The active autonomous pipeline is
`goals`; do not auto-trigger this skill for ordinary debugging requests.

The **skeptic** of the fleet. Where `/legacy-planner` plans and `/legacy-coder` builds, `/legacy-debugger`
deliberately tries to break what was built — on a different model from the one that
wrote it, which is the whole point: the misreading that produced a bug also produces a
confident review of that bug, and only an outside context breaks that correlation.
It makes sure the repo has a **personalized auditor agent** (creating it if absent,
reusing it if present), then runs that agent as a **systematic debugger**: read the
context, hunt bugs through four nets, fix them test-first, move the ticket on. It
**composes** `/legacy-planner` and `/legacy-coder` rather than reinventing them — bugs are framed with
`/legacy-planner`'s ticket format (invariant + `Verification-command`) and fixed with `/legacy-coder`'s
test-first loop. The ticket trail is the audit log.

## Your place in the fleet loop

```
Planned → Agent Ready → Coding → Debugger Ready → Debugging → Review Ready → Reviewing → Done
   └ /legacy-planner ─┘  └──── /legacy-coder ────┘   └──── /legacy-debugger ────┘   └──── /legacy-reviewer ────┘
```

### Stage-parent session

The default debugger is GPT-5.6 Luna in a separate top-level Codex session using
**maximum reasoning effort**. It may use auditor helpers inside that independent
stage-parent session when the harness supports them. If `/legacy-debugger` was launched as a
native child, it must perform the audit directly and must not spawn nested children.
The debugger model must remain different from the Kimi maker and from the Grok
reviewer.

**Your board moves:** claim from **`Debugger Ready`** → **`Debugging`** before you
touch anything → **`Review Ready`** when the gate is green and the corners are
covered. Each move updates the GitHub Project item's canonical `Status` field —
for **only the ticket you are working**; the rest of `Debugger Ready` stays idle.
Read `~/.claude/skills/github-projects-pipeline/SKILL.md` for the exact `gh project`
mechanics, live field/option IDs, read-back-after-write rule, and the
**no-project fallback**.

**No GitHub Project? The debugging pass still runs in full.** Attack the same
corners, verify the same invariants, fix test-first against the same gate, and
record the findings and the resulting stage in the project's local tracker or the
handoff. Say which mode you're in. The audit is the value here; the label is only
the receipt.

You are the **hardener**, not the judge. You may fix anything you find — that's the
difference between you and `/legacy-reviewer`, which only ever writes findings down. But you do
**not** close tickets: when you're satisfied, the ticket moves to **Review Ready** and
an independent reviewer on yet another model decides whether it may close. Don't review
your own repairs; you just became an author of them.

Two modes, same machinery:

- **Ticket mode (the default).** A ticket sits in `Debugger Ready` — take the
  lowest-numbered one, move it to `Debugging`, attack *its* diff, fix what breaks,
  move it to `Review Ready`. Prefer tickets `/legacy-reviewer` bounced back as correctness
  failures: read the review comment, which names the exact defect and the bounce count.
- **Sweep mode.** No ticket named, or the user points at a directory — hunt the whole
  scope for bugs nobody filed. Fixes that are small and in-scope get made directly;
  anything larger gets **filed as a new ticket in `Agent Ready`** (or `Planned` if it
  needs grilling) rather than smuggled into an unrelated diff.

> **The global stage-parent profile is the default; a project's CONTEXT may override it.**
> The default `/legacy-debugger` parent is GPT-5.6 Luna in the Codex harness at maximum
> reasoning. What *is* non-negotiable is that the debugger is not the same model or
> context that wrote the code. If you cannot confirm that, say so.

## Before you start

Confirm the ticket (ticket mode) or the directory / scope (sweep mode) — if the user
didn't name either, take the oldest ticket in `Debugger Ready`, and say which you
picked. Read
the project's **CONTEXT / invariant docs** (glossary/`CONTEXT.md`, release-scope /
invariants planning docs, ADRs) and the **newest handoff**, so the audit is grounded
in the project's real constraints — not guesses. If a **retrieval router**
(`ROUTER.md`) sits beside those docs, enter through it — its index lines carry
status, so a superseded ADR is visible without opening it, and you attack the
code against the constraint that is actually live. Note the project's **test command**,
**test globs**, and the **gate command** shape it already uses (defer tracker / label /
doc conventions to the sub-skills — keep this orchestrator project-agnostic).

### Draining the queue — "debug all of them"

One ticket per run is the default. When the user asks for the whole queue ("harden
everything in Debugger Ready"), repeat this skill **end-to-end, serially**: claim
one ticket, run Steps 1–3 on it, land it in `Review Ready`, then start again from
`Before you start` for the next. Do not claim the batch and do not merge several
tickets' repairs into one undifferentiated diff — `/legacy-reviewer` reviews per ticket, and a
diff spanning five tickets is one it cannot attribute.

Two habits make this loop reliable:

- **Re-query the board between tickets, never cache the list.** `/legacy-coder` may push
  new work into `Debugger Ready` while you're mid-audit, and `/legacy-reviewer` may bounce a
  correctness failure back into it — those belong in the loop.
- **One ticket in `Debugging` at any moment.** Step 0's agent bootstrap happens
  once for the whole run, not once per ticket; only Steps 1–3 repeat.

Stop when the queue comes back empty, when the budget is spent, or when a ticket
blocks hard. Then report each ticket, what broke, and where it landed — one line
each. If `Debugger Ready` is empty at the start, say so and offer sweep mode
instead of inventing tickets.

**The authorized exception.** If the user explicitly authorizes *parallel* hardening
— not merely "all of them" — read the route table in
`~/.claude/skills/parallel-subagent-implementation/SKILL.md` and follow it. Its
preconditions bind: disjoint lanes proven, baseline green recorded, one commit per
ticket, and you re-run every worker's gate yourself. Repairs still never review
themselves, and every ticket still lands in `Review Ready`, never `Done`.

## Step 0 — Ensure the personalized agent (idempotent; mini /legacy-planner + /legacy-coder)

Check for **`.claude/agents/legacy-debugger-<slug>.md`** (`<slug>` = the repo / project name). This auditor belongs to the independent debugger stage-parent session; it is not permission for a native child of another session to create a grandchild:

- **It exists** → **reuse it verbatim.** Do not recreate or regenerate it — that's the
  whole point of idempotent. Skip to Step 1. (If its pins are genuinely stale, *edit*
  the file, don't overwrite it wholesale.)
- **It's missing** → **create it now, in this same run**, via a mini `/legacy-planner` + `/legacy-coder`:
  - **mini `/legacy-planner` (plan):** inspect the repo and lock what the agent reviews — stack,
    test framework, test globs, gate-command shape, the CONTEXT/invariant docs to
    attack, and the tracker + `/legacy-planner` ticket format.
  - **mini `/legacy-coder` (build):** write `.claude/agents/legacy-debugger-<slug>.md` from
    `AGENT-TEMPLATE.md` (in this skill folder) with those pins. It's the personalized,
    git-committable **maker**.

  Then continue straight into Step 1 — no stopping.

The pins are what make this agent worth generating: a general auditor doesn't know
your test globs, your gate command, or which invariant doc is live. When the file
can't be written (read-only checkout, no `.claude/` to commit into), don't stop and
don't fake it — run the pinned loop yourself in this session, or hand the four nets
to `feature-dev:code-reviewer` with the pins written into its prompt, and say in the
handoff that the agent was not persisted.

## Step 1 — Harden via `/multi-agent-review` (`harden` mode, pipeline operating mode)

In ticket mode, move **that one project item** to **`Debugging`** first — update
and read back the Project `Status` field — so the board shows it's in flight. Move
nothing else: if seven tickets sit in `Debugger Ready` and you're
debugging one, six stay put. A column full of tickets nobody is working destroys the
only thing an in-flight column is for.

Then run `/multi-agent-review` (`harden` mode, pipeline operating mode): the
orchestrator (this stage-parent session) plus its fixed default trio each
independently execute the `debugger-<slug>` auditor's pinned loop below — same
pins, same task — in their own isolated worktree, branched off the ticket's
already-landed diff. If this `/legacy-debugger` run is itself a native child, it
executes the pinned loop directly, as the orchestrator's own attempt, and must
not spawn a nested auditor of its own.

Every participant's pinned loop:
1. **Read the CONTEXT / invariant docs first** so the audit is grounded.
2. **Run the tests** it discovers via its globs; record every red (failing) test.
3. **Audit for bugs — four nets** (the absorbed auditor is nets 3–4). **State the full
   list before fixing anything:**
   - **failing tests** (from step 2);
   - **static errors** — the type-checker + linter from the gate command;
   - **invariant violations** — check the *code* actually honors each latency budget,
     failure-mode contract, and security/consent boundary in the docs. Needs real
     reading, not a grep;
   - **weak / uncovered tests** — invariants with no real covering test, and
     tautological / over-mocked tests that assert nothing. A missing test for an
     invariant is itself a bug — the fix is to write it.
4. **Red-team the corners** (the pass `/legacy-coder` deliberately didn't run) — what's
   *latently* wrong, the corners agent-written code fails in, which a green
   happy-path suite says nothing about. Do **not** re-run the happy path; the
   suite already covers it, and re-verifying it is how a debugger spends its
   whole budget confirming what was known.
   - **Weird inputs** — empty, null, zero, negative, oversized, wrong-type, malformed,
     duplicate, unicode/emoji, injection-shaped, out-of-range dates, timezone boundaries.
   - **Failure modes** — exactly the ones the ticket's invariants name: each dependency
     down, slow, rate-limited, or returning garbage. Confirm the code degrades, retries,
     or surfaces **as specified** rather than crashing, hanging, or swallowing the error
     into a fake success. A `try/catch` that logs and continues is usually a broken
     failure mode wearing the costume of a handled one; code with no timeout doesn't
     fail, it hangs.
   - **Sequences & crash-safety** — two calls racing, retry after partial success, the
     same webhook twice (idempotency), a crash between the write and the publish.
   - **Permission & boundary edges** — wrong user, missing/expired/forged token, privilege
     escalation, another tenant's identifier, the trust edges the `/legacy-planner` invariants drew.
     On row-level-security projects, confirm the query runs under the constrained role and
     not a service client that bypasses the policy.
5. **Per bug — frame then fix:** frame it as a `/legacy-planner` ticket (name the violated
   invariant + write the `Verification-command` gate), record it in the tracker as the
   audit trail, then fix it **test-first** (red→green only) until the gate exits 0.
   **Budget 5** attempts per bug; on exhaustion, record it as an unfixed follow-up
   rather than thrashing.

Relay rounds until unanimous sign-off or the 6-round cap — this is where the
loop earns its cost over a single auditor: a bug one participant's pass found
and another's didn't gets surfaced in critique and fixed in every worktree,
raising every entrant's floor, not just cross-examining one already-known fix.
**After each fix, re-run the gate command**, so a corner-fix can't silently
regress a neighbor. Then auto-pick the highest-rated worktree; its fixes,
merged onto the ticket's branch, are the hardened result. This is also where
**refactoring** happens (`/legacy-coder` defers it here on purpose, so feature diffs
stay reviewable): the winning participant fixes the smells it finds —
mysterious names, duplicated code, feature envy, data clumps, primitive
obsession, repeated switches, divergent change, speculative generality,
message chains, middleman.

Log every participant's bug list, fixes, and rating in the handoff (Step 3),
not just the winner's — a bounce three stages later needs to know what the
losing attempts missed too, not only what shipped.

## Step 2 — Move the ticket to Review Ready

When the gate is green and the corners are covered, move the project item to
**`Review Ready`** — update and read back the Project `Status` field — and stop.
Leaving it parked in `Debugging` after you finish is the same failure as never moving
it: the column stops meaning "live right now." Do not review your own work and do not close it — `/legacy-reviewer` decides
that, blind, on another model, and it will read the diff without your explanation of
it. Anything you left unfixed goes **on the ticket** as a named follow-up, not only in
the handoff: `/legacy-reviewer` never reads handoffs, so an undisclosed gap simply reappears as a
bounce.

In sweep mode there may be no single ticket to move. File what you found instead —
fixed items as GitHub Project items in `Review Ready`, unfixed ones in `Agent Ready`
(or `Planned` if they need grilling), with the Project `Status` read back — and say
where each landed.
If a sweep does work several existing tickets, move each into `Debugging` **as you
reach it** and out again as you finish, never claiming the batch up front.

## Step 3 — Hand off and push (both required)

1. **`handoff`** — write a handoff doc (the project's usual location + the `$TMPDIR`
   copy): which tests were red, what the four-net audit found, **what the red-team pass
   attacked and what broke**, what was fixed (gates green), refactors applied, honest
   follow-ups, which ticket you moved to `Review Ready` (or where swept findings were
   filed), and the next thing to review.
2. **`push-handoff`** — **always run this last.** Read and follow the `push-handoff`
   skill (`~/.claude/skills/push-handoff/SKILL.md`): stage the changed code + ticket
   trail + agent file + handoff, commit, push a **feature branch**, open/update a **PR
   into main**. **`/legacy-debugger` is not complete until push succeeds** (or you report an auth
   blocker with the skill's recovery steps). Never commit secrets, never merge the PR.

## Rules

- **Idempotent bootstrap, one invocation.** Create the personalized agent once (via
  mini `/legacy-planner` + `/legacy-coder`) only if it's missing; reuse it verbatim if it exists; never
  regenerate. Bootstrap **and** run happen in the same `/legacy-debugger` — no stop-and-rerun.
- **The gate is "done," not a judgment call.** A bug is fixed when its
  `Verification-command` exits 0 — same discipline as `/legacy-coder`.
- **Move the project item**: `Debugger Ready` → `Debugging` when you start →
  `Review Ready` when the gate is green, updating and reading back the Project
  `Status` every time — and **only for the ticket you're working**, never the queue.
  See `~/.claude/skills/github-projects-pipeline/SKILL.md`.
- **Drain the queue serially when asked for "all of them"** — Steps 1–3 per
  ticket, re-query the board between laps, never more than one ticket in
  `Debugging` at a time.
- **Never review your own fixes.** You repaired this code, so you are its author now —
  `/legacy-reviewer` judges it, blind and on another model. Move the ticket to `Review Ready`;
  never to `Done`.
- **Disclose unfixed gaps on the ticket, not just in the handoff.** `/legacy-reviewer` never
  reads handoffs by design, so an undisclosed gap comes straight back as a bounce.
- **Attack corners, don't re-run the happy path.** The suite already covers it;
  re-verifying it burns the budget that should go to the failure modes.
- **Compose, don't reinvent.** Frame bugs with `/legacy-planner`'s ticket format and fix them
  through the same `/multi-agent-review` (`harden` mode) that `/legacy-coder` runs in `build`
  mode; the existing services / ADRs are the source of truth. The
  ticket trail is the audit log, not a second planning system.
- End with a short summary: whether the agent was created or reused, bugs found (by
  net), **what the red-team pass broke**, bugs fixed, follow-ups, **the ticket you moved
  to `Review Ready`** (or where swept findings were filed), the **pushed commit hash**,
  and the remote branch — omitting the state move or the push means the run failed.
