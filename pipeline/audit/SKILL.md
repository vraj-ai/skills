---
name: audit
version: 1.0.0
description: Audit a whole codebase rather than a single diff — establish the boundary and baseline, sweep layer by layer (entry points, domain, data, integrations, auth, tests, ops), check every stated invariant for a real enforcement point, a failing-on-violation test, and a production signal, rank findings by blast radius, and emit each as a ticket with a Verification-command. Use when asked to audit an app or codebase, assess a project's health, review before a launch, verify that a security/performance/privacy claim is actually enforced, or produce a prioritized defect backlog.
recommended: false
---

# audit

Reviewing a diff asks whether a change is correct. An audit asks whether a **system** is
sound: what is broken, what is merely claimed, and what would tell you if either changed.
The output is a ranked, ticketed backlog with evidence attached — not an essay.

Two questions run through every step:

1. **What is wrong?** — defects, found by sweeping the layers.
2. **What is only asserted?** — invariants documented in a plan or a comment but not
   enforced in the shipped path. An invariant that is documented but not enforced is a wish.

## Step 1 — Boundary and baseline

Before reading code, write down:

- Repo, branch, commit SHA under audit
- What is in scope (packages, apps, services) and what is explicitly out
- What evidence will count — the commands you will run
- The invariants the project claims, quoted **verbatim** from the plan, spec, ADRs, or
  README. Do not paraphrase; paraphrasing softens them. If the project states no
  invariants anywhere, that is finding #1.
- Baseline: does it build? do tests pass? how long does the suite take?

```
git log --oneline -5
git status -sb
```

Run build, typecheck, and the full suite **once**, up front, and record the real output.
An audit that starts without a baseline cannot tell pre-existing rot from new damage.

## Step 2 — Map before judging

Produce a one-screen map: entry points, major modules, data stores, external providers,
auth boundary, deploy target. Blast radius cannot be ranked without knowing what is
downstream of what, and an invariant cannot be traced without knowing where execution
actually enters.

## Step 3 — Sweep layer by layer

For each layer, look for what that layer specifically gets wrong:

**Entry points** (routes, handlers, CLI, jobs, webhooks) — unvalidated input; missing
authorization at the *real* entry rather than the UI; no timeout; unbounded payloads.

**Domain / business logic** — logic leaking into controllers or UI; vocabulary drift from
the glossary or ADRs; invariants asserted in comments instead of code; primitive obsession
where a type would prevent a class of bug.

**Data layer** — missing constraints or indexes; N+1 queries; transactions that do not wrap
what they claim; migrations that are not reversible; no tenancy filter on a shared table.

**Integrations** — replay, ordering, idempotency, signature verification, cost exposure.
See `provider-integration-tdd`.

**Auth & permissions** — the boundary enforced in one path but not another; wrong-tenant
access untested; secrets in code, logs, or committed env files.

**Tests** — coverage of the *production* seam versus parallel fake paths; over-mocking;
tautologies; substring assertions; happy-path only; focused-test markers left in; suite
runtime that discourages running it.

**Ops** — no signal for the failure modes that matter; unstructured logs; PII in logs; no
way to tell if an invariant regressed.

**Hygiene** — duplicate `file 2.ts` artifacts, dead code, TODOs older than the feature,
dependencies pinned nowhere.

## Step 4 — Put every invariant through the three-column test

The layer sweep finds defects. This finds fictions. For each invariant collected in Step 1,
fill in all three columns; a blank in any column is a finding.

| Invariant | Enforcement point | Proof (test) | Production signal |
|---|---|---|---|
| "p95 create < 200ms" | where is it bounded? | what test measures it? | what alerts if it regresses? |

- **Enforcement point** — the actual file:line in the **production path** that makes the
  invariant hold. Not the plan. Not a comment. A code location, reached by grepping and
  then tracing from the real entry point found in Step 2. If that line cannot be drawn, the
  invariant is not enforced where it matters.
- **Proof** — a test that **fails** when the invariant is violated. Prove the test is real
  by asking what change would make it fail; if nothing obvious would, it is weak. The
  cheapest check is often writing a test that *should* fail and watching it pass.
- **Production signal** — a metric, alert, log, or check that would surface a violation in
  the wild. Optional for some invariants; its absence is still stated, never omitted.

Sweep these categories, marking `N/A + reason` where genuinely inapplicable. A missing
category is a finding, not a gap to fill in silently.

- **Performance / resource budgets** — concrete numbers. "Fast" is not an invariant.
- **Failure and recovery per dependency** — down, slow, rate-limited, or returning garbage.
  What does the user see? Retried, surfaced, or degraded?
- **Security & authorization boundaries** — who may do what, and the blast radius when it is wrong.
- **Privacy** — what data leaves the system, what gets logged, what is retained.
- **Permissions / tenancy** — cross-tenant access denied, and **tested explicitly**.
- **Data integrity** — uniqueness, referential rules, idempotency, migration reversibility.
- **UX / compatibility / ops** — wherever the project named them.

Fake enforcement has recognisable shapes:

| Pattern | Why it is fake enforcement |
|---|---|
| Enforced in the **test helper**, not the production path | The app does not do it; the test does |
| Assertion in a code comment or type name only | Nothing runs |
| The test mocks the very component that enforces it | Tautology — proves the mock works |
| Budget asserted against a warm cache or a single run | Not a measurement, a coincidence |
| Authorization checked at the UI, not the API | Bypassable |
| Tenancy checked on read but not write, or the reverse | Half a boundary is no boundary |
| "Handled gracefully" with no observable | Unfalsifiable — cannot be reviewed |
| Satisfied only on the path the test takes | Production takes a different path |

Each invariant ends with a verdict: **enforced** (all three columns real) ·
**documented-only** (no enforcement point) · **unproven** (enforced, but no test fails on
violation) · **violated** (demonstrated broken). Anything but *enforced* becomes a finding
and flows into Step 5 with the rest.

## Step 5 — Rank by blast radius, not by ease

| Severity | Definition |
|---|---|
| **P0** | Data loss, security/tenancy breach, money loss, or the app is broken in production |
| **P1** | Launch-blocking; a documented invariant is demonstrably violated |
| **P2** | Real defect with a workaround; significant test weakness; an invariant enforced but unproven |
| **P3** | Hygiene, clarity, minor duplication |

Rank on impact × likelihood. A trivially-fixable typo is not P0 because it is easy, and a
hard refactor is not P3 because it is hard.

## Step 6 — Every finding becomes a ticket

```
Title: [audit] <short defect>
Severity: P0..P3
Evidence: <file:line, or command + verbatim output>
Impact: <what breaks, for whom>
Invariant violated: <if any, plus verdict: documented-only / unproven / violated>
Proposed fix: <smallest correct change>
Verification-command: `<exact command that proves the fix>`
Blocked-by: <if any>
```

A finding without a Verification-command is not ready for an implementer. A finding without
evidence is not a finding — it is an opinion.

## Step 7 — Report

```
Audit of <repo> @ <sha>
Baseline: build PASS  typecheck FAIL (3 errors)  suite 412 pass / 7 fail / 1m48s
Scope: <in> / <out>

Invariants
| Invariant | Enforcement (file:line) | Proof (test) | Signal | Verdict |
|---|---|---|---|---|

Findings
P0 (n): ...
P1 (n): ...
P2 (n): ...
P3 (n): ...

Tickets emitted: <range or list>
Not investigated: <honest list — what you did not have time or access to check>
```

The **"not investigated"** section is mandatory. An audit that implies total coverage it did
not achieve is worse than a narrow honest one.

## Non-negotiables

- Evidence before verdict, for every claim: file:line or command output.
- Never accept the author's narrative that something works or that an invariant holds.
  "The plan says so" is not enforcement.
- Do not fix while sweeping. Sweep, rank, then fix or ticket deliberately.
- Do not rewrite architecture under the banner of an audit.
- State what was not covered.
- Secrets found: report the location and that rotation is needed — **never paste the secret**.
- Write findings into the repository under audit or the tracker it uses; nothing outside it.

## Related

`implementation-tdd` · `issues` · `delivery-constraints`
