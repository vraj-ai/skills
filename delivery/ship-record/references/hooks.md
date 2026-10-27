# Automatic checkpoints

`observe` captures where the work actually is and writes `<slug>.observed.json`
next to the record. It never edits the record, because the record's `Updated`
line is the model's attestation and a stale one is evidence: `check` reports
"newer than the record" when a checkpoint is ahead of it.

The observation holds the branch, full head SHA, worktree, changed and untracked
paths, the upstream ref with ahead/behind counts, and whether the head is pushed.
It is mechanical only. Context, Design, Next, and Open still come from the model,
because a hook cannot know them.

## Running it

```sh
node ~/.agents/skills/ship-record/scripts/ship-record.mjs observe            # the one open record for this branch and worktree
node ~/.agents/skills/ship-record/scripts/ship-record.mjs observe <slug>     # a named record
```

Without a slug it takes the single open record whose `Updated` line names the
current branch and worktree. Two candidates, or none, prints nothing and exits 0. Hook mode never fails: a missing repository, a bad slug, or an unreadable record is silent, because a checkpoint must not break the host session.

## Opting in to a host hook

No repository hook is installed by default, and `setup-vskills` does not write
host configuration without being asked. Where the host reads a settings file,
add `observe` to its stop and pre-compaction events yourself.

Claude Code reads `settings.json` in the project or user configuration
directory. This adds two hooks that run the checkpoint at the end of a turn and
before context compaction:

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node ~/.agents/skills/ship-record/scripts/ship-record.mjs observe" } ] }
    ],
    "PreCompact": [
      { "hooks": [ { "type": "command", "command": "node ~/.agents/skills/ship-record/scripts/ship-record.mjs observe" } ] }
    ]
  }
}
```

Merge those entries into hooks you already have rather than replacing the file.
The command exits 0 in every failure mode, so a hook that fires outside a
repository is harmless.

Hosts without a verified hook event are not worse off than before: the skill
text asks the agent to run `observe` at each phase boundary, and `check` still
reports drift from the record's own attestation.
