---
name: provider-integration-tdd
version: 1.0.0
description: Test-first method for integrations with external providers — queues, signed webhooks, idempotent lifecycle operations, and owned artifacts — where the failure modes are delivery-order, replay, partial failure, and forged payloads rather than plain logic bugs. Use when implementing or auditing a webhook receiver, a job queue consumer, a payment/billing lifecycle, an upload/artifact pipeline, or any code path where a third party can call you back.
---

# provider-integration-tdd

Provider integrations fail in ways unit tests of your own logic never surface: the same event arrives twice, out of order, forged, or three days late.

## The four hazard classes

Every provider integration must have tests for whichever of these apply:

### 1. Queues and delivery semantics

- **At-least-once is the default.** Assume duplicates. Test that processing the same message twice produces one effect.
- **Order is not guaranteed.** Test out-of-order arrival explicitly (e.g. `updated` before `created`).
- **Partial failure.** What happens when step 2 of 3 throws? Test that you don't leave a half-applied state.
- **Poison messages.** A permanently-failing message must not block the queue forever. Test the dead-letter path.

### 2. Signed webhooks

- **Verify the signature before parsing the body.** Test that an invalid signature is rejected *and* that nothing was written.
- **Test a forged payload with a valid-looking shape.** Signature checks that are accidentally skipped in one branch are common.
- **Timestamp/replay window.** Test that an old-but-correctly-signed payload is rejected.
- **Raw body handling.** Frameworks that re-serialize JSON break HMAC verification. Test against the raw bytes.
- **Never log the signing secret or the full payload** if it carries PII.

### 3. Idempotent lifecycle

- Every state-changing operation needs an **idempotency key** and a test that replaying it is a no-op.
- Test the **full lifecycle path**: created → updated → canceled → refunded, including terminal-state transitions that must be rejected.
- Test that a **retry after a timeout** (where the provider succeeded but you never saw the response) doesn't double-charge / double-provision.
- Money and provisioning are the classic cases: a duplicate is not a cosmetic bug.

### 4. Owned artifacts

- Assert ownership/tenancy on every read *and* write. Test **wrong-tenant access explicitly** — this is the invariant most often assumed and least often tested.
- Test lifecycle: orphaned artifacts, cleanup, and what happens when the provider's copy disappears.
- Signed URLs: test expiry and scope.

## Seams, not mocks

- Inject the provider client; the **production path must go through the same seam** the test does. Monkeypatching the module under test creates a green suite over a broken app.
- Prefer a **fake with a contract test** against the real provider's documented behavior over an ad-hoc mock that returns whatever makes the test pass.
- **Live provider calls cost money and are separately authorized.** Default test runs must never hit a paid API. If a contract test needs live access, gate it behind an explicit env flag and say so on the ticket.
- Record the provider's real error shapes (rate limit, auth failure, 5xx) and test your handling of each: retried, surfaced, or degraded — the ticket's invariants say which.

## Invariants to state on the ticket

A provider ticket's invariants should pin, concretely:

- Timeout and retry policy (counts, backoff, ceiling)
- What the user sees when the provider is down / slow / rate-limited
- Idempotency guarantee and its key
- Signature verification requirement
- Tenancy boundary
- Whether any test path may spend money

"Handles errors gracefully" is not an invariant. `On 429, retry 3× with exponential backoff to 8s, then surface a retryable error to the caller` is.

## Verification

```
- [ ] Duplicate delivery test (exactly-once effect)
- [ ] Out-of-order delivery test
- [ ] Invalid signature rejected AND no side effect written
- [ ] Replay/timestamp window enforced
- [ ] Idempotent retry proven for every money/provisioning operation
- [ ] Wrong-tenant access denied
- [ ] Provider-down / rate-limited behavior matches the stated invariant
- [ ] No test hits a paid API without explicit authorization
- [ ] Production path uses the same seam the tests do
```

## Related

`ticket-implementation-tdd` · `invariant-evidence-review` · `coder` · `debugger` · `delivery-constraints`
