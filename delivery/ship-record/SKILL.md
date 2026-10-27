---
name: ship-record
version: 1.0.0
description: Check, attest, and export the ship record every delivery skill shares. Reads the record at $(git rev-parse --git-common-dir)/vskills/ship/<slug>.md, validates its fields, phases, and sizes, reports whether the recorded branch still points at the recorded head, and fails closed on a required-but-stale record. Use from ship, land, snapshot, and resume-work, or directly when a record looks stale.
dependencies: []
recommended: false
argument-hint: "[slug]"
---

# Ship record

One reader and checker for the record `ship`, `land`, `snapshot`, and `resume-work` share. The format is [references/record.md](references/record.md). This skill owns that format and the checker; the delivery skills own the policy that decides what to do with the answer.

The record lives inside git's own directory, so it is never committed and every worktree of the repository sees it.

## Commands

```sh
node <install-root>/ship-record/scripts/ship-record.mjs              # every open record
node <install-root>/ship-record/scripts/ship-record.mjs <slug>       # one record, any phase
```

`<install-root>` is the vskills install root, `~/.agents/skills` on every host vskills installs into. Write it out in full: Windows shells do not expand `~` for `node`.

A record is valid when it carries `Phase`, `Size`, `Updated`, and `Next`, its phase and size are known values, and `Updated` matches `<ISO time>, <branch> at <head SHA>, <worktree>` with a parseable time.

## Reading the result

- `head: current` means the recorded branch still points at the recorded head.
- `head: moved to <sha>` means the branch advanced after the record was written. The checker reports it and still exits 0, so a listing can show every record. A skill that requires a current record must check both the exit status and the `head:` line, or pass the strict flag once this skill provides one.
- `branch <name> missing` means the recorded branch does not resolve in this repository, which is normal on a fresh clone before the branch is fetched.

Exit status is 0 for a readable record, 1 for an invalid or missing record, and 2 when the slug is a path rather than a record name, or the command runs outside a repository.

## Rules

- Never write the record from this skill. `ship` and `snapshot` write it; the checker only reads.
- Fix what the checker reports rather than editing the checker's expectations.
- A record with a moved head is evidence, not an error. Say which one you found.
