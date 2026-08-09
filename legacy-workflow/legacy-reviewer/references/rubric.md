# /legacy-reviewer review rubric

The six dimensions in judging order. Read this before forming a verdict — reviewing
from memory produces vague findings, and vague findings bounce tickets forever
without ever telling anyone what to change.

**Contents**
- [How to use this rubric](#how-to-use-this-rubric)
- [1. Ticket fidelity (blocking)](#1-ticket-fidelity-blocking)
- [2. Invariant integrity (blocking)](#2-invariant-integrity-blocking)
- [3. Test honesty (blocking)](#3-test-honesty-blocking)
- [4. Corner behavior (blocking)](#4-corner-behavior-blocking)
- [5. Domain fit (advisory, blocking only on drift risk)](#5-domain-fit-advisory-blocking-only-on-drift-risk)
- [6. Craft (advisory)](#6-craft-advisory)
- [Scoring](#scoring)
- [Calibration: what a good reviewer looks like](#calibration-what-a-good-reviewer-looks-like)

## How to use this rubric

Walk the dimensions in order. Stop early only in one case: if dimension 1 finds
an acceptance criterion that simply isn't implemented, that's a scope failure —
record it, route to Agent Ready, and don't spend a deep pass on the rest.

For each dimension, the question is always **"can I name the input and the wrong
output?"** A finding you can't state as *trigger → wrong behavior* is an
impression, not a defect. Impressions belong in Advisory.

## 1. Ticket fidelity (blocking)

Take the acceptance criteria **one at a time** and point to the line of the diff
that satisfies each. Not the file — the line.

The failure mode this catches is the most common one in agent-written code:
four of five criteria implemented beautifully and the fifth silently dropped,
wrapped in a confident summary claiming all five. Enumerating forces you to
notice the gap; skimming for overall vibe does not.

- Criterion satisfied → cite `file:line`.
- Criterion partially satisfied (happy path only, one of two entry points) →
  blocking, route **Agent Ready**.
- Criterion absent → blocking, route **Agent Ready**.
- Criterion impossible to satisfy as written, or contradicted by another
  criterion → blocking, route **Planned**. This is a ticket defect; sending it to
  a coder guarantees another bounce.

Also check for **scope inflation**: work in the diff that no criterion asked for.
It is not automatically blocking, but unrequested refactors riding along inside a
feature ticket make the diff unreviewable and hide regressions. Flag it advisory;
block only if the extra work touches an invariant the ticket didn't cover.

## 2. Invariant integrity (blocking)

For each invariant `/legacy-planner` locked and the ticket restated, decide whether **this
code** honors it. This requires reading, not grepping — an invariant is honored
by behavior, not by the presence of a keyword.

**Latency / performance budgets.** Look for what the budget forbids: an N+1
query in a loop, an unbounded fetch, a sequential await chain where the ticket
promised concurrency, a missing index on a new query path, an unbounded payload.
State the budget, the code path, and why the path can exceed it.

**Failure modes.** For each external dependency the ticket names, find the code
that runs when it is down, slow, rate-limited, or returns garbage. Check that the
*specified* behavior happens — retry, degrade, surface — and not a generic
`catch` that swallows the error and returns success. A `try/catch` that logs and
continues is usually a broken failure mode wearing the costume of a handled one.
Also check timeouts exist at all: code with no timeout doesn't fail, it hangs,
which is worse than the failure the invariant described.

**Security / permission boundaries.** Trace the trust edge. Who can call this?
What happens with a wrong user, a missing or expired or forged token, another
tenant's identifier, a nested resource whose parent belongs to someone else? For
row-level-security projects, confirm the query actually runs under the
constrained role rather than an admin/service client that bypasses the policy —
this is the single most common way an RLS invariant is violated by code that
looks correct.

An invariant that the diff neither honors nor breaks — because nothing in the
diff touches it — is not a finding. Say "not exercised by this diff" and move on.

## 3. Test honesty (blocking)

Green tests are evidence only if the tests would go red when the behavior breaks.
Judge whether they would.

- **Tautological** — asserts on a value it just constructed, or asserts a mock
  was called rather than that anything happened. Blocking.
- **Over-mocked** — the mocks are so complete that the real code path never
  executes; the test verifies the fixture. Blocking when it's the *only* test for
  an invariant.
- **Uncovered invariant** — a named invariant with no test that would catch its
  violation. Blocking, route **Agent Ready**: a missing test for an invariant is
  itself a defect, not a nice-to-have.
- **Happy-path-only** — no test for the failure modes the ticket names. Blocking
  if the ticket named them.
- **Wrong seam** — testing vendor SDK internals or render details instead of the
  behavior. Advisory; it's brittleness, not incorrectness.

Useful instrument: for each test, ask *"what single line could I delete from the
implementation and still see this pass?"* If the answer is "the whole feature,"
the test is honest. If it's "most of it," it isn't.

## 4. Corner behavior (blocking)

Attack the corners agent-written code reliably fails in. Do not re-run the happy
path — the suite already covers it, and re-verifying it is how reviewers spend
their whole budget confirming what's already known.

- **Inputs**: empty, null/undefined, zero, negative, oversized, wrong-type,
  malformed, duplicate, unicode/emoji, injection-shaped, out-of-range dates,
  timezone boundaries.
- **Sequences**: two calls racing, retry after partial success, cancel mid-flight,
  a webhook arriving before the record it references, the same webhook arriving
  twice (idempotency), a crash between write and publish.
- **State**: empty collection, single item, pagination boundary, the resource
  deleted between read and write.

Blocking when the result is a crash, data corruption, a stuck non-terminal state,
or a boundary crossed. Advisory when it's merely an unhelpful error message.

Idempotency and crash-safety deserve specific attention on anything that writes
plus calls an external service: "what if the process dies right here?" asked at
each write is the cheapest high-yield question available.

## 5. Domain fit (advisory, blocking only on drift risk)

Does the code speak the project's language and use its existing services, or has
it grown a parallel implementation?

- New logic that duplicates an existing service → **blocking** when the two can
  drift into disagreement about something that matters (permissions, pricing,
  entitlements, consent). Name the concrete divergence. Otherwise advisory.
- Vocabulary that contradicts the glossary → advisory, but say the right word;
  terminology drift compounds and is cheapest to fix at review time.
- A decision that contradicts an ADR → blocking, route **Planned**: the code and
  the architecture disagree, and only a human can say which is wrong.

## 6. Craft (advisory)

Refactor smells: mysterious names, duplicated code, feature envy, data clumps,
primitive obsession, repeated switches, divergent change, speculative generality,
message chains, middleman.

These are **advisory by default and should stay that way.** A reviewer that blocks
on taste will block indefinitely — every diff has smells, the coder will fix the
named ones and introduce others, and the ticket never closes while the fleet
learns to treat reviewing as noise. Promote a smell to blocking only when you can
name the concrete future failure: "this permission check is duplicated in three
files; when one changes, the others silently authorize" is a defect. "This
function is long" is not.

## Scoring

Assign 0–100 **after** the PASS/FAIL decision, as a description of it. It never
makes the decision — see the SKILL for why calibration makes it unfit as a gate.

- **90–100** — passes cleanly; advisory findings at most.
- **75–89** — passes, but with advisory findings worth carrying into a follow-up.
- **50–74** — fails on one or two nameable blocking defects; a targeted fix away.
- **25–49** — fails on several blocking defects, or an invariant is broken.
- **0–24** — gate red, or the ticket is largely unimplemented.

Score the diff against **this ticket's** scope. A small correct diff is a 95, not
a 70 for being small.

## Calibration: what a good reviewer looks like

**Too lenient** looks like: passing because the tests are green and the code
reads well; accepting "handled" without checking what the handler does; treating
absence of visible bugs as evidence of correctness. The cost is a false pass —
the defect ships, and everything built on top inherits it.

**Too strict** looks like: blocking on style, on preferred architecture, on tests
the ticket never asked for; writing findings like "consider whether this is
robust." The cost is churn — real tokens spent on cosmetic edits, and a fleet
that learns to ignore the reviewer.

The calibration to hold: **block on what you can prove, advise on what you
suspect, and say plainly which is which.** A reviewer that passes a diff with three
honest advisory notes is doing better work than one that fails it with three
unfalsifiable ones.

When genuinely unsure whether a finding blocks, ask: *would I be comfortable
telling the user this shipped?* If yes, it's advisory.
