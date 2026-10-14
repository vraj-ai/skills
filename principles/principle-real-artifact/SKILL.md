---
name: principle-real-artifact
version: 1.0.0
description: Verify every claimed outcome against the real artifact — run the feature, read the actual value, inspect the diff — never against a proxy, a self-report, or a build pass. Apply after completing any task, before declaring done, and whenever reading evidence produced by a worker, a ticket, or a pipeline state.
recommended: false
---

# Principle: the real artifact

Check the thing itself, not a proxy for it. "It compiles" is not behavior. "The
worker said done" is a report. "State says green" is a claim. Only the running
artifact answers the question.

## The rule

| Claim | Proxy that proves nothing | The real check |
|---|---|---|
| The feature works | Build pass, typecheck, HTTP 200 on a health endpoint | Run the feature the way a user would; observe the output |
| The fix landed | Worker's summary, ticket moved to done | `git log`, the diff at the head SHA, the gate run fresh |
| The value is correct | A cached field, a derived metric, a screenshot of old state | Read the actual value from the live system |
| The process is healthy | A status file, an uptime counter | Direct liveness evidence on the process itself |

A model verdict is still a verdict. An agent's "I verified it" without an
attached artifact is the same class of claim as a ticket's green state — treat
both as unverified until the check has been re-run or its output read.

## Script the check when you can

The strongest proof is a deterministic command that re-runs the same
comparison, not a one-time eyeball. Write it, run it, keep the output. A
reviewer should be able to re-run your evidence instead of trusting your word.

Keep the artifact visible to the human. Commit it only when the trail must be
auditable later — a migration, a port, a disputed delivery — per the project's
own conventions.

## When the observation fails

Suspect the observation method before suspecting the system. A timed-out probe,
a stale cache, a detached worktree are all cheaper explanations than "the code
is wrong." Re-establish a trustworthy channel first; then judge the system.

Missing evidence is reported as missing evidence. It is never filled in with a
plausible story.
