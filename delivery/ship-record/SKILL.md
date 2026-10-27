---
name: ship-record
version: 1.3.0
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
- `head: moved to <sha>` means the branch advanced after the record was written. A plain listing reports it and exits 0, so every record can be seen. `check --require head` is the strict form: it exits 3, which is the only result that admits work into the next step.
- `branch <name> missing` means the recorded branch does not resolve in this repository, which is normal on a fresh clone before the branch is fetched. It is also exit 3 under `--require head`.
- `observed: ... (newer than the record)` means a checkpoint ran after the last attestation. The checkpoint is evidence of where the work is; the record still has to be updated by the agent.

Exit status is 0 for a readable record, 1 for an invalid or missing record, and 2 when the slug is a path rather than a record name, or the command runs outside a repository.

## Checkpoints and verdicts

`observe` writes `<slug>.observed.json` with the branch, head, worktree, dirty paths, upstream counts, and pushed state. It never edits the record, so the model's attestation and its drift stay visible. Hook setup, including the opt-in Claude Code entries, is in [references/hooks.md](references/hooks.md).

`attest` is the only writer of `Updated`, and it reads the branch, head, and worktree from git. `verdict add` owns only the row for its own PR: prose an agent writes anywhere in the record, Verdicts included, is preserved. `verdict add` stores the patch-id of a PR's full diff; `verdict check` exits 3 unless the current patch still matches it.

## Handoff

`handoff export` writes the record and a captured position: branch, head, upstream with ahead/behind, pushed, and the changed and untracked paths. It refuses to write inside the repository, so the document cannot be committed by accident, and it refuses a record that looks like it holds a credential. Dirty file contents are never included; the text says so.

`handoff import` restores a record from an exported document and backs up the previous file. The imported claims are unproven until the repository agrees: attest, then `check --require head`.

## Rules

- Never write the record from this skill. `ship` and `snapshot` write it; the checker only reads.
- Fix what the checker reports rather than editing the checker's expectations.
- A record with a moved head is evidence, not an error. Say which one you found.
