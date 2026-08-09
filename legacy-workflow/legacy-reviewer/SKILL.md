---
name: legacy-reviewer
version: 1.2.0
description: Legacy review stage from the former planner-coder-debugger-reviewer fleet, preserved for explicit opt-in use. Use only when the user invokes /legacy-reviewer or deliberately requests the old GitHub Projects stage workflow instead of goals.
---

# /legacy-reviewer — Former review chain

This is the preserved legacy workflow. The active autonomous pipeline is
`goals`; do not auto-trigger this skill for ordinary review requests.

The **gate** of the fleet. `/legacy-planner` frames the work, `/legacy-coder` builds it, `/legacy-debugger`
debugs and hunts for what nobody filed, and `/legacy-reviewer` decides whether any of it is
allowed to close. It is the only skill in the fleet with the authority to move a
ticket to **Done**, and the only one whose job is to say *no*.

Its value comes from one property: **the judge did not write the code, and is not
the same model that wrote it.** A model reviewing its own output shares its own
blind spots — the same misreading of the spec that produced the bug produces a
confident approval of the bug. An independent judge on a different model breaks
that correlation. Protect that independence above all else; everything in this
skill exists to keep the judgment uncontaminated.

> **The global stage-parent profile is the default; a project's CONTEXT may override it.**
> The default `/legacy-reviewer` parent is Grok 4.5 in the Pi harness through OpenRouter. What
> *is* non-negotiable is that the reviewer is a **different context and a different
> model than the one that produced the diff** — if you cannot confirm that, say so
> in the verdict rather than quietly reviewing anyway.

## Your place in the fleet loop

```
Planned → Agent Ready → Coding → Debugger Ready → Debugging → Review Ready → Reviewing → Done
   └ /legacy-planner ─┘  └──── /legacy-coder ────┘   └──── /legacy-debugger ────┘   └──── /legacy-reviewer ────┘
```

### Stage-parent session

The default reviewer is Grok 4.5 in a separate top-level Pi session through OpenRouter.
It must be a fresh, independent context from both the Kimi maker and the Codex
debugger. If helpers are used, give every helper only the ticket, diff, gate, and
invariant docs; never pass the coder/legacy-debugger handoff or author rationale before the
verdict. A native child launched from another session must not spawn nested children.

**Your board moves:** claim from **`Review Ready`** → **`Reviewing`** before you
read a line of the diff → **`Done`** on a pass, or back to `Debugger Ready` /
`Agent Ready` / `Planned` on a fail. Each move updates the GitHub Project item's
canonical `Status` field — for **only the ticket you are reviewing**; the rest of
`Review Ready` stays idle. Read `~/.claude/skills/github-projects-pipeline/SKILL.md`
for the exact `gh project` mechanics, live field/option IDs, read-back-after-write
rule, and the **no-project fallback**.

You are the only stage that may set `Done`. Review the project's built-in workflows
before starting; an automatic closed-issue or merged-PR transition must not bypass
this blind review.

**No GitHub Project? The review still runs in full.** Judge the diff blind
against the same rubric, reach the same PASS/FAIL, and record the verdict and its
routing in the project's local tracker or the handoff — including the bounce
count, since without a board that history has nowhere else to live. Say which
mode you're in. What matters is that an independent judge looked; where the
verdict is filed is secondary.

## Before you start

Identify the **ticket under review**. If the user named one, use it. If not, take
the oldest ticket in the tracker's **`Review Ready`** state; if several, review
the lowest-numbered one and say which you picked. If none are waiting, say so and
stop — do not invent work.

**Move that one ticket to `Reviewing` now**, before reading the diff, so the board
shows a review in progress. Move nothing else: claiming the whole `Review Ready`
queue would mark six tickets as under judgment while one actually is.

### Draining the queue — "review all of them"

One ticket per run is the default. When the user asks for the whole queue ("review
everything in Review Ready", "pick them all up"), do not reinterpret that as
reviewing them in parallel or claiming them as a batch. Run the **entire** skill —
claim, gate, judge, route, comment — to completion on one ticket, then start over
from `Before you start` for the next. The board should never show more than one
ticket in `Reviewing` because of you.

**The fan-out exception does not reach this stage.** `parallel-subagent-implementation`
exists so `/legacy-coder` and `/legacy-debugger` can widen when the user authorizes it. Reviewing is
different in kind: the verdict is the product, and a helper that judges on your
behalf becomes the judge — the one role this skill exists to keep independent and
uncontaminated. Helpers may fetch a diff or run the gate; only you weigh the rubric
and route the ticket. No authorization changes that.

Two habits make this loop reliable:

- **Re-query the queue between tickets, never cache it.** The list you fetched at
  the start is already stale — `/legacy-debugger` may have pushed new work into `Reviewing
  Ready` while you reviewed, and a ticket you bounced could have come back. Ask the
  tracker again each lap and take the lowest-numbered ticket that is still there.
- **Route each ticket before touching the next.** A verdict that hasn't moved its
  ticket isn't delivered, and a half-finished lap left in `Reviewing` blocks the
  fleet on a ticket nobody is actually judging.

Stop the loop when the queue comes back empty, when the user's budget is spent,
or when something blocks the run outright (auth failure, a red gate you cannot
even execute). Then report every ticket you reviewed, its verdict, and where it
landed — one line each. **If the queue is empty at the very start, say so and
stop.** An empty queue means the fleet is caught up, not that you should go find
something else to judge.

The same shape applies to every stage: the queue is discovered from the board, not
from the user, and it is drained one ticket at a time with exactly one ticket
claimed at any moment.

Then gather exactly three things, and deliberately nothing else:

1. **The diff** — the changes attributable to this ticket (its branch/PR, or the
   commit range since it entered Coding).
2. **The ticket** — What-to-build, Acceptance-criteria, the named invariants, and
   the `Verification-command` that `/legacy-planner` shipped with it.
3. **The project's CONTEXT / invariant docs** — glossary, ADRs, the invariants
   the effort locked. Enter through the **retrieval router** (`ROUTER.md`) if the
   repo has one, and review against the *live* decision — an index line marked
   superseded means that ADR is not the standard, and failing a diff for
   contradicting a reversed decision is a bad bounce.

### What you must NOT read

Do not read the `/legacy-coder` or `/legacy-debugger` **handoff doc**, the author's PR
description, its commit messages' justifications, its self-assessment, or any
sub-agent transcript explaining *why* the code is correct.

This restriction is not bureaucratic. A confident narrative from the author is
the single strongest contaminant of a model's judgment: once you have read "this
is safe because we validate upstream," you will look for that validation and see
it, whether or not it is there. The diff either demonstrates the property or it
does not. If you catch yourself reasoning from a claim rather than from a line of
code, you have already been contaminated — go back to the diff.

Reading the handoff *after* you have written your verdict, purely to check
whether the author flagged a known follow-up, is fine. Never before.

## Step 1 — The cheap gate runs first

Run the ticket's `Verification-command` (plus the project's typecheck/lint if the
command doesn't already include them).

**If it does not exit 0, stop reviewing.** Return a fail immediately, routed to
**Debugger Ready**, quoting the failing output. There is no point spending a
careful judgment pass on code the compiler already rejects, and a reviewer that
argues about naming while the suite is red teaches the fleet that the gate is
optional. Deterministic checks are cheaper, faster, and more reliable than you
are — let them do their half of the job.

If the ticket has no runnable `Verification-command`, that is a `/legacy-planner` defect,
not a code defect: route it to **Planned** with that reason.

## Step 2 — Judge against the rubric

Only now, with a green gate, do the judging that only a model can do. Read
`references/rubric.md` for the full dimension-by-dimension criteria; it is the
substance of this step, so read it before forming a verdict rather than reviewing
from memory.

The six dimensions, in the order they should be weighed:

| # | Dimension | The question it answers |
|---|-----------|-------------------------|
| 1 | **Ticket fidelity** | Does the diff satisfy *every* acceptance criterion — not most? |
| 2 | **Invariant integrity** | Do the named latency budgets, failure modes, and security/consent boundaries actually hold in this code? |
| 3 | **Test honesty** | Do the tests fail if the behavior breaks — or are they tautological, over-mocked, or asserting on their own fixtures? |
| 4 | **Corner behavior** | Empty, null, oversized, malformed, unicode, duplicate, concurrent, out-of-range — does it degrade as specified or crash? |
| 5 | **Domain fit** | Does it use the project's vocabulary and existing services, or fork/duplicate domain logic? |
| 6 | **Craft** | Refactor smells: mysterious names, duplication, feature envy, data clumps, primitive obsession, repeated switches, speculative generality, message chains, middleman. |

Dimensions 1–4 can **block**. Dimensions 5–6 can only **advise** unless the
violation is severe enough to name a concrete future failure — a duplicated
permission check that will drift out of sync blocks; an ugly variable name does
not. This asymmetry matters: a reviewer empowered to block on taste will block
forever, and the fleet will learn to route around it.

### Verdict shape: binary, with a score as diagnostics only

The gate is **PASS or FAIL**. Also report a 0–100 score, but understand what it
is for and what it is not.

A score is a *trend instrument* — useful across many tickets to see whether
quality is drifting. It is a **bad gate**, because model-assigned numbers are not
calibrated: they cluster in the 70s and 80s, drift between runs on an identical
diff, and track diff size more faithfully than diff quality. Thresholding on that
is a coin flip near the boundary. So decide PASS/FAIL from the rubric — from
named, quotable defects — and let the number describe the decision rather than
make it.

**PASS requires**: the gate green, every acceptance criterion met, every named
invariant demonstrably held, and no blocking finding in dimensions 1–4.
Everything else is recorded as advisory and does not stop the close.

**Every finding must be falsifiable.** Give `file:line`, the concrete input or
sequence that triggers it, and the wrong behavior that results. "Error handling
could be more robust" is not a finding — it cannot be argued with, so it cannot
be fixed, and it will bounce the ticket forever. If you cannot name the failing
case, you do not have a finding; you have an opinion. Say so, mark it advisory,
and let the ticket pass.

## Step 3 — Route the outcome

The verdict is only useful if it moves the ticket. Route by **the kind of
failure**, not to a single default lane — collapsing every fail into one bucket
throws away the diagnosis you just performed and sends bugs to whoever happens to
be next.

| Verdict | Route to | When |
|---------|----------|------|
| **PASS** | **Done** | Gate green, no blocking finding. Close it. |
| **FAIL — correctness** | **Debugger Ready** | It's built but wrong: bug, unhandled failure mode, broken invariant, crash on a corner. |
| **FAIL — scope / tests** | **Agent Ready** | It's not wrong, it's *missing*: an unimplemented acceptance criterion, an invariant with no covering test, tautological tests. |
| **FAIL — bad ticket** | **Planned** | The ticket is unbuildable as written: contradictory criteria, no `Verification-command`, an invariant that can't be satisfied. Not the coder's fault; don't send it to one. |

Every route is a real Project move out of `Reviewing`: update the GitHub Project
item's `Status` field and read it back. Labels are not a second state machine. A
ticket left sitting
in `Reviewing` after you've decided is worse than unreviewed work — it looks claimed,
so nothing else will touch it.

That third row is the one fleets forget, and it is the origin of most infinite
loops: a ticket that cannot be satisfied gets bounced between builder and
debugger indefinitely, each doing competent work on an impossible task.

### Bounce budget — how the loop terminates

Track how many times this ticket has been reviewed (a tracker field, a label, or a
line in the ticket body — whatever the project uses; state which).

- **Bounce 1 and 2** — route normally as above.
- **Bounce 3** — stop routing. Escalate to the **human**, with the full bounce
  history: what each review found, what each fix changed, and your read on why it
  isn't converging.

A ticket that has failed three reviewers is rarely a coding problem. It is usually
an ambiguous acceptance criterion, two invariants in genuine conflict, or a
reviewer fixating on something the rubric doesn't actually forbid. More laps will
not surface that; a human looking at the pattern will. Escalating is a success
condition of this skill, not a failure of it.

## Step 4 — Record the verdict on the ticket

Post the verdict as a comment on the ticket itself, so the review is durable and
the bounce history is reconstructable by the next reviewer. Use this structure:

```
## Review: PASS | FAIL  (score: NN/100, diagnostic only)
Bounce: N of 3
Gate: <verification-command> → exit 0 | exit N

### Blocking findings   (omit if none)
- [dimension] file.ts:42 — <defect>. Trigger: <concrete input/sequence>. Result: <wrong behavior>.

### Advisory            (omit if none)
- [dimension] file.ts:88 — <finding>.

### Routing
→ <Done | Debugger Ready | Agent Ready | Planned | Human escalation> — <one-line reason>
```

Then move the GitHub Project item out of `Reviewing` to that state and read it back.
**A verdict that doesn't move the project item has not been delivered** — the board is the fleet's
shared memory, and a review that lives only in chat is invisible to the next run.

On escalation (bounce 3), leave the ticket in `Reviewing` and say so explicitly:
it's genuinely stuck mid-judgment awaiting a human, which is exactly what that
column should then show.

## Step 5 — Hand off and push (both required)

1. **`handoff`** — write a handoff doc (the project's usual location + the
   `$TMPDIR` copy): which ticket was reviewed, PASS/FAIL and score, the blocking
   findings, where it routed and why, the bounce count, and anything escalated.
2. **`push-handoff`** — **always run this last.** Read and follow the
   `push-handoff` skill (`~/.claude/skills/push-handoff/SKILL.md`). `/legacy-reviewer` is
   not complete until push succeeds (or you report an auth blocker with the
   skill's recovery steps). Never commit secrets.

**`/legacy-reviewer` does not fix code.** When it finds a defect it writes it down and
routes it; it does not open the file and repair it. The moment the reviewer starts
authoring fixes it becomes an author, and there is no longer an independent judge
anywhere in the loop — the one thing this skill exists to provide.

## Rules

- **Judge blind.** Diff + ticket + invariant docs only. No handoff, no PR
  narrative, no author rationale until after the verdict is written.
- **Different model, different context** from whoever produced the diff. If that
  can't be confirmed, say so in the verdict rather than reviewing anyway.
- **Cheap checks first.** Red gate → immediate fail to Debugger Ready; never
  spend judgment on code the compiler already rejected.
- **Binary gate, score as diagnostics.** PASS/FAIL comes from named defects. The
  0–100 number is a trend line, never the threshold.
- **Findings are falsifiable or they're advisory.** `file:line` + trigger +
  wrong behavior, or it doesn't block.
- **Route by failure kind** — correctness → Debugger Ready, scope/tests → Agent
  Ready, bad ticket → Planned. Never one default lane.
- **Move the project item**: `Review Ready` → `Reviewing` before you read
  the diff → its routed state after the verdict, updating and reading back the
  Project `Status` every time, and **only for the ticket you're reviewing**. See
  `~/.claude/skills/github-projects-pipeline/SKILL.md`.
- **Only you may set `Done`.** No other stage closes tickets; don't let one talk
  you into treating its handoff as a verdict.
- **Drain the queue serially when asked for "all of them"** — full skill per
  ticket, re-query the board between laps, never more than one ticket in
  `Reviewing` at a time.
- **Escalate at bounce 3.** Three failed reviews is a human problem; another lap
  won't find it.
- **Never fix what you review.** Findings and routing only.
- **Taste advises, it doesn't block** — unless you can name the concrete future
  failure it causes.
- End with a short summary: the ticket reviewed, PASS/FAIL + score, blocking
  findings, **the Project `Status` you moved it to**, the bounce count, the
  **pushed commit hash**, and the remote branch — omitting the routing or the push
  means the run failed.
