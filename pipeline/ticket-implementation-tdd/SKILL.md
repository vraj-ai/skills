---
name: ticket-implementation-tdd
version: 1.0.0
description: Strict one-ticket TDD for pipeline work — lock the Verification-command before editing, drive red-green at the highest meaningful seam, keep provider calls behind test-safe seams that the production path actually uses, and finish with native checks (typecheck, lint, build) plus the gate re-run. Use when implementing a Coding ticket, especially one touching external providers, persistence, or auth, and whenever coder needs the detailed implementation loop.
---

# ticket-implementation-tdd

The detailed maker loop `coder` invokes. One ticket. Gate first. Real seams.

## Step 1 — Lock the gate BEFORE editing

Take the ticket's `Verification-command` verbatim. Then:

1. **Run it before any change.** You need to know whether it was already green, already red, or doesn't run at all.
2. If it doesn't run (missing harness, wrong path, no such script) — that's a **ticket defect**. Fix the command with the user's agreement *before* treating it as the done-definition, and note the correction on the ticket.
3. If the ticket has no command, derive one and get it agreed. Do not invent a private definition of done.

Once locked, the gate does not move to accommodate your implementation. If the gate is wrong, you change it deliberately and say so — you never quietly relax it.

## Step 2 — Red at the highest meaningful seam

Write the failing test at the **outermost seam that still fails fast and specifically**:

- Prefer a real domain/service/API boundary over a unit test of a private helper.
- The test must exercise the seam **production traffic actually uses**. A test against a path the app never takes proves nothing — this is the single most common false-green in this pipeline.
- Watch the test fail. A test that passes before you write the code tests nothing.
- Assert on **anchored tokens**, not substrings. `not.toContain("9.99")` breaks against `"119.99"`.

Cover the corners the ticket's invariants imply, not just the happy path: malformed, empty, oversized, concurrent, hostile input; dependency down/slow/rate-limited; wrong-tenant and unauthorized access.

## Step 3 — Green with the smallest correct change

- Smallest change that makes the test pass honestly.
- **No opportunistic rewrites** tangled into the ticket.
- Preserve the codebase's domain vocabulary and module boundaries — if the ticket forces you to violate one, that's a bounce-worthy finding, not a thing to quietly do.
- Scope is **one ticket**. Discoveries outside it become follow-up tickets, not extra diff.

## Step 4 — Provider-safe seams

For anything crossing a network or costing money:

- Put the provider behind a **seam the production path uses too** — inject the client; don't monkeypatch the module under test.
- Tests use a **fake/contract-tested double**, not a mock of the code under test. Mocking the thing you're testing produces a tautology.
- **Live provider calls cost money and are separately authorized.** Never let a test suite hit a paid API by default.
- Idempotency, retry, timeout, and signature verification are **invariants to test**, not implementation details to assume. See `provider-integration-tdd`.

## Step 5 — Refactor under green

Only with the gate green. Behavior unchanged. Re-run after.

## Step 6 — Native checks + final gate

In this order:

```
typecheck  →  lint  →  build (if applicable)  →  the locked gate  →  proportional broader suite
```

The gate must be re-run **after the final edit**. A gate run three edits ago is not evidence. Paste the output verbatim.

Sweep for junk before finishing: duplicate `file 2.ts` artifacts, stray console logs, commented-out code, `.only` left on a test.

## Step 7 — Evidence

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

## Non-negotiables

- One ticket per run.
- Gate locked before the first edit, re-run after the last.
- Red before green, or a stated justified exception.
- Test the production seam, not a parallel fake path.
- Never claim a command passed without running it.
- Unrelated dirty files are sacred — stage only ticket-owned paths.

## Related

`coder` · `tdd` · `provider-integration-tdd` · `audit` · `shared-worktree-safety`
