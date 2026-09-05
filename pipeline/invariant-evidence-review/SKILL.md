---
name: invariant-evidence-review
version: 1.0.0
description: Audit whether a project's stated invariants are actually ENFORCED and MEASURED in the shipped path, rather than merely mentioned in a plan or asserted in a comment — for each invariant find the enforcement point, the test that proves it, and the signal that would catch its violation in production. Use when reviewing a diff against locked invariants, as net 3 of debugger's audit, before accepting a security/performance/privacy claim, or when the user asks whether a constraint is real.
---

# invariant-evidence-review

An invariant that is documented but not enforced is a **wish**. This skill separates the two.

## The three-column test

For every stated invariant, fill in all three columns. A blank in any column is a finding.

| Invariant | Enforcement point | Proof (test/measure) | Production signal |
|---|---|---|---|
| "p95 create < 200ms" | where is it bounded? | what test measures it? | what alerts if it regresses? |

- **Enforcement point** — the actual line/module in the **production path** that makes the invariant hold. Not the plan. Not a comment. A code location.
- **Proof** — a test that **fails** when the invariant is violated. If violating it keeps the suite green, there is no proof.
- **Production signal** — what would surface a violation in the wild: a metric, an alert, a log, a check. Optional for some invariants; its absence should still be stated.

## Categories to sweep

Take the locked invariants from the plan; if the plan doesn't have them, that's finding #1. Sweep these categories, marking `N/A + reason` where genuinely inapplicable:

- **Performance / resource budgets** — concrete numbers. "Fast" is not an invariant.
- **Failure and recovery per dependency** — down / slow / rate-limited / returning garbage. What does the user see? Retried, surfaced, or degraded?
- **Security & authorization boundaries** — who may do what, and the blast radius when it's wrong.
- **Privacy** — what data leaves the system, what gets logged, what's retained.
- **Permissions / tenancy** — cross-tenant access denied, and **tested explicitly**.
- **Data integrity** — uniqueness, referential rules, idempotency, migration reversibility.
- **UX / compatibility / ops** — where the plan named them.

## Failure patterns to look for

| Pattern | Why it's fake enforcement |
|---|---|
| Invariant enforced in the **test helper**, not the production path | The app doesn't do it; the test does |
| Assertion in a code comment or type name only | Nothing runs |
| Test mocks the very component that enforces it | Tautology — proves the mock works |
| Budget asserted against a warm cache / single run | Not a measurement, a coincidence |
| Authz checked at the UI, not the API | Bypassable |
| Tenancy checked on read but not write (or vice versa) | Half a boundary is no boundary |
| "Handled gracefully" with no observable | Unfalsifiable — cannot be reviewed |
| Invariant satisfied only on the path the test takes | Production takes a different path |

The last one deserves the most attention: **trace from the real entry point** (route handler, CLI entry, job consumer) to the enforcement point. If you can't draw that line, the invariant isn't enforced where it matters.

## Method

1. List the invariants from the plan/ticket verbatim. Don't paraphrase — paraphrasing softens them.
2. For each, **grep to the enforcement point** in the production path.
3. For each, find the test — then **prove the test is real** by asking: what change would make it fail? If nothing obvious would, it's weak.
4. Try to violate it. The cheapest audit is often writing a test that *should* fail and seeing it pass.
5. Record the three-column table with real file:line references.

## Output

```
Invariant audit — <scope>

| Invariant | Enforcement (file:line) | Proof (test) | Signal | Verdict |
|---|---|---|---|---|
| ... | ... | ... | ... | enforced / documented-only / unproven / violated |

Findings:
1. <invariant> — <verdict> — evidence: <command output or file:line>
   Impact: ...
   Suggested ticket: <title> — verification: `<cmd>`
```

Verdicts: **enforced** (all three columns real) · **documented-only** (no enforcement point) · **unproven** (enforced but no failing-on-violation test) · **violated** (demonstrated broken).

## Non-negotiables

- Evidence before verdict. Cite file:line or command output for every claim.
- Never accept the author's narrative that an invariant holds.
- "The plan says so" is not enforcement.
- A missing invariant category is a finding, not an omission to be filled in silently.

## Related

`debugger` · `planner` (locks the invariants) · `implementation-tdd` · `code review` workflows
