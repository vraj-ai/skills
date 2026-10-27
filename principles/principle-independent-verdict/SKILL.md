---
name: principle-independent-verdict
version: 2.0.0
description: Only a verdict from a context that did not write the code counts — an author checks what it meant to build, not what it built, and an author-verified claim on its own diff is not enough. Apply before trusting any review, CI-green diff, self-certification, or self-verified work on a nontrivial change, including verdicts carried across rebases where the patch may have drifted.
recommended: false
---

# Principle: the independent verdict

An author checks what it meant to build. A verifier checks what it built. Those
are different objects, and only the second one protects a merge.

## The rule

A review, a verification pass, or a "tested" claim on a nontrivial change
counts when the examining context did not write the examined code: a separate
agent, a separate session, a CI job, or a human reviewer. Self-verification is
still required — it just isn't a verdict. It is the author's own check before
requesting one.

Green CI and an approving bot review are supporting evidence, not a verdict on
behavior: neither runs the change the way a user would. The strongest
independent verdict runs the real artifact per principle-real-artifact.

## Verdicts are bound to a patch, not a branch

A verdict covers the code the verifier saw. A rebase, retarget, or new push
moves the head to a new SHA without failing any check. Before trusting a
verdict made at an older SHA:

1. Compare the patch-id of the whole diff under review —
   `git diff <base>...<sha> | git patch-id` — at the verdict SHA and the
   current head. The head commit's patch-id misses an earlier commit drifting
   under an unchanged tip patch.
2. Same patch-id — the verdict stands.
3. Anything else: a new commit, a rebase, a retarget, a changed test, a
   changed document, a changed lint config. The old verdict never saw this
   code, so re-verify. There is no path-class exception: a file that looks
   like documentation is executable behaviour wherever an agent reads it,
   and a test or lint change moves the gate the verdict relied on.
4. An unresolvable revision, an empty diff, or a failed patch-id
   computation is unverified. It is never treated as a match.

Reviews and checks apply to the examined head SHA. Recheck after every push.
