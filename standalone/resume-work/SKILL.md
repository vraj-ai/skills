---
name: resume-work
version: 2.4.0
description: Pick up exactly where a stopped or paused task stopped, at the same phase. Reads the ship record, verifies which claims of the previous session or agent still hold against the repo, reloads only the context the next step needs, and keeps going with ship or land. In the same chat after a usage limit it re-reads nothing. In a fresh chat the record carries the context. Use to resume after a limit resets, or to take over a task another agent claims it finished.
dependencies: [ship, snapshot, ship-record, principle-evidence-over-report]
argument-hint: "[record slug, issue, or task]"
recommended: true
---

# Resume work

`ship` and `snapshot` leave a ship record (format in ship-record's references/record.md). This skill continues from it. The record is a pointer, and the repo is the truth: re-prove the position before building on it.

## 1. Same chat or fresh chat

**Same chat.** The session stopped on a usage limit or a pause, and this conversation still holds the work. Do not re-read the record's context or re-run any context skill. Run step 2's live checks, then continue at the last next action.

**Fresh chat.** Find the record:

1. The argument: a slug, an issue, or a path.
2. Otherwise the open records: `node ~/.agents/skills/ship-record/scripts/ship-record.mjs` lists every record in `$(git rev-parse --git-common-dir)/vskills/ship/` whose phase is not done. One record means use it. Several means show that list, then ask which.
3. No record, or a handoff the user points to: import it with `node ~/.agents/skills/ship-record/scripts/ship-record.mjs handoff import <slug> --from <file>`, then attest and re-prove it here. An imported record is a claim until the repository agrees. No handoff either: rebuild from the tracker. Failing that, run pstack `/recall` on the topic and rebuild the position from the tracker and branches. Invoke it with the Skill tool, then as `pstack:recall`. If neither resolves, read `~/.agents/packs/pstack/pstack/skills/recall/SKILL.md` (or `$VSKILLS_PACK_PSTACK/pstack/skills/recall/SKILL.md`). Without pstack, search the tracker and `git log` yourself and say so.

Load the record's Context and Design as your working context. They replace `recall`, `how`, `why`, and `teach`. Run those again only where step 2 shows the code under them changed. Then read only the files the next action touches.

## 2. Re-prove the position

Check each claim against the repo, in order:

1. `node ~/.agents/skills/ship-record/scripts/ship-record.mjs <slug>`, then `git status -sb` and `git log`. A malformed record or `head: moved` is a broken claim: the recorded head is not the current one, so the record is at least one commit stale. Say which, then check `git log <recorded head>..HEAD` before trusting Next. Did anything land since?
2. The tracker. The current state of each recorded issue and PR, and any comment newer than the record's Updated time.
3. The verification. Does the gate still pass at the current head?
4. The context. Have the files anchored in Context changed since the recorded head (`git diff <recorded head> -- <files>`)? If so, run `/how` on just those files and correct the Context section.

Where the record and the repo disagree, the repo is right. Say so and continue from the proven position. Authority the prior session held (push, merge, comment) expired with it. Only currently granted authority applies.

## 3. Continue at the phase

| Phase | Continue with |
|---|---|
| context | ship's Context, from the first step the record lacks |
| design | ship's Design. Open grill questions go to the user first. |
| issues | `/issues` for the units not filed yet |
| build | ship's Build or Prove, on the first unfinished issue, at its next step |
| review | ship's Review and deliver, at the current head SHA |
| land | `/land` on the recorded PRs |
| blocked | the blocker. Ask only if it is a product decision. |
| done | Nothing. Report and stop. |

A stale next action (landed, superseded, blocked elsewhere) gets re-derived from the tracker's real state, with what changed stated. A broken claim, such as a moved branch or a gate that is red at a claimed-green head, is new work. Run `/debug` on the drift before resuming the plan.

From here ship's rules apply, including updating the record at each phase boundary and `/snapshot` on the next stop.

Report which claims held, which did not, and where you resumed.
