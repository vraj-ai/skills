---
name: implementation-tdd
version: 1.0.0
description: Strict one-ticket TDD for implementation work — lock the Verification-command before editing, drive red-green at the highest meaningful seam production traffic actually uses, and prove the provider failure modes (duplicate and out-of-order delivery, replay, partial failure, forged payloads, wrong-tenant access) rather than assuming them. Use when implementing a Coding ticket, and whenever the change touches an external provider, a queue, a signed webhook, a billing or provisioning lifecycle, persistence, or auth.
recommended: false
---

# implementation-tdd

One ticket. Gate first. Real seams. The tests that matter are the ones that fail
for the reason production would.

Plain logic bugs are the easy half. Anything crossing a network fails in ways a
unit test of your own code never surfaces: the same event arrives twice, out of
order, forged, or three days late. Both halves run through the same loop below.

## Step 1 — Lock the gate BEFORE editing

Take the ticket's `Verification-command` verbatim. Then:

1. **Run it before any change.** You need to know whether it was already green,
   already red, or doesn't run at all.
2. If it doesn't run (missing harness, wrong path, no such script) — that's a
   **ticket defect**. Fix the command with the user's agreement *before*
   treating it as the done-definition, and note the correction on the ticket.
3. If the ticket has no command, derive one and get it agreed. Do not invent a
   private definition of done.

Once locked, the gate does not move to accommodate your implementation. If the
gate is wrong, you change it deliberately and say so — you never quietly relax it.

## Step 2 — Red at the highest meaningful seam

Write the failing test at the **outermost seam that still fails fast and
specifically**:

- Prefer a real domain, service, or API boundary over a unit test of a private helper.
- The test must exercise the seam **production traffic actually uses**. A test
  against a path the app never takes proves nothing — this is the single most
  common false-green in this pipeline.
- Watch the test fail. A test that passes before you write the code tests nothing.
- Assert on **anchored tokens**, not substrings. `not.toContain("9.99")` breaks
  against `"119.99"`.

Cover the corners the ticket's invariants imply, not just the happy path:
malformed, empty, oversized, concurrent, hostile input; dependency down, slow, or
rate-limited; wrong-tenant and unauthorized access.

## Step 3 — Green with the smallest correct change

- Smallest change that makes the test pass honestly.
- **No opportunistic rewrites** tangled into the ticket.
- Preserve the codebase's domain vocabulary and module boundaries — if the ticket
  forces you to violate one, that's a bounce-worthy finding, not a thing to
  quietly do.
- Scope is **one ticket**. Discoveries outside it become follow-up tickets, not
  extra diff.

## Step 4 — Seams for anything crossing a network or costing money

- Put the provider behind a **seam the production path uses too** — inject the
  client. Monkeypatching the module under test creates a green suite over a
  broken app.
- Tests use a **fake with a contract test** against the provider's documented
  behavior, not an ad-hoc mock that returns whatever makes the test pass. Mocking
  the thing you are testing produces a tautology.
- **Live provider calls cost money and are separately authorized.** Default test
  runs must never hit a paid API. If a contract test needs live access, gate it
  behind an explicit environment flag and say so on the ticket.
- Record the provider's real error shapes (rate limit, auth failure, 5xx) and
  test your handling of each: retried, surfaced, or degraded — the ticket's
  invariants say which.

Idempotency, retry, timeout, and signature verification are **invariants to
test**, not implementation details to assume.

## Step 5 — The four provider hazard classes

Write a red test for whichever of these the ticket touches. They are failure
modes, not features, so nothing else in the suite will catch them.

### Queues and delivery semantics

- **At-least-once is the default.** Assume duplicates. Test that processing the
  same message twice produces one effect.
- **Order is not guaranteed.** Test out-of-order arrival explicitly — an
  `updated` event landing before its `created`.
- **Partial failure.** What happens when step 2 of 3 throws? Test that you don't
  leave a half-applied state.
- **Poison messages.** A permanently-failing message must not block the queue
  forever. Test the dead-letter path.

### Signed webhooks

- **Verify the signature before parsing the body.** Test that an invalid
  signature is rejected *and* that nothing was written.
- **Test a forged payload with a valid-looking shape.** Signature checks
  accidentally skipped in one branch are common.
- **Timestamp and replay window.** Test that an old-but-correctly-signed payload
  is rejected.
- **Raw body handling.** Frameworks that re-serialize JSON break HMAC
  verification. Test against the raw bytes.
- **Never log the signing secret** or a full payload carrying PII.

### Idempotent lifecycle

- Every state-changing operation needs an **idempotency key** and a test that
  replaying it is a no-op.
- Test the **full lifecycle path** — created, updated, canceled, refunded —
  including terminal-state transitions that must be rejected.
- Test that a **retry after a timeout**, where the provider succeeded but you
  never saw the response, doesn't double-charge or double-provision. Money and
  provisioning are the classic cases: a duplicate is not a cosmetic bug.

### Owned artifacts

- Assert ownership and tenancy on every read *and* write. Test **wrong-tenant
  access explicitly** — this is the invariant most often assumed and least often
  tested.
- Test lifecycle: orphaned artifacts, cleanup, and what happens when the
  provider's copy disappears.
- Signed URLs: test expiry and scope.

## Step 6 — Refactor under green

Only with the gate green. Behavior unchanged. Re-run after.

## Step 7 — Native checks and the final gate

In this order:

```
typecheck  →  lint  →  build (if applicable)  →  the locked gate  →  proportional broader suite
```

The gate must be re-run **after the final edit**. A gate run three edits ago is
not evidence. Paste the output verbatim.

Sweep for junk before finishing: duplicate `file 2.ts` artifacts, stray console
logs, commented-out code, a `.only` left on a test.

## Step 8 — Evidence

```
Implemented <owner>/<repo>#<issue-number>.
Paths: <list>
Gate: `<cmd>`
Output:
<verbatim>
Native checks: typecheck ✅ lint ✅ build ✅
Broader: `<cmd>` → pass
Commit: <sha>
Invariants: <held / unproven>
```

## Invariants a provider ticket must pin

State these concretely on the ticket before implementing, because each one is a
test you owe:

- Timeout and retry policy — counts, backoff, ceiling
- What the user sees when the provider is down, slow, or rate-limited
- The idempotency guarantee and its key
- Signature verification requirement
- Tenancy boundary
- Whether any test path may spend money

"Handles errors gracefully" is not an invariant. `On 429, retry 3× with
exponential backoff to 8s, then surface a retryable error to the caller` is.

## Verification checklist

```
- [ ] Gate locked and run before the first edit, re-run after the last
- [ ] Every new behavior had a failing test first
- [ ] The test drives the seam production traffic uses
- [ ] Duplicate delivery test (exactly-once effect)
- [ ] Out-of-order delivery test
- [ ] Partial-failure test — no half-applied state
- [ ] Invalid signature rejected AND no side effect written
- [ ] Replay and timestamp window enforced
- [ ] Idempotent retry proven for every money or provisioning operation
- [ ] Wrong-tenant access denied
- [ ] Provider-down and rate-limited behavior match the stated invariant
- [ ] No test hits a paid API without explicit authorization
- [ ] typecheck, lint, build clean
```

## Non-negotiables

- One ticket per run.
- Gate locked before the first edit, re-run after the last.
- Red before green, or a stated justified exception.
- Test the production seam, not a parallel fake path.
- Never claim a command passed without running it.
- Unrelated dirty files are sacred — stage only ticket-owned paths.
- Nothing written outside the repository under work.

## Related

`audit` · `subagent-delegation` · `delivery-constraints`
