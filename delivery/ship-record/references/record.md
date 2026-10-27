# The ship record

One markdown file per ship run at `$(git rev-parse --git-common-dir)/vskills/ship/<slug>.md`. It sits inside git's own directory, so it is never committed, never shows in a diff, and every worktree of the repo sees it. `<slug>` is the issue number or a short kebab-case name for the objective.

`ship` writes it. `land`, `snapshot`, and `resume-work` update it. It is the only local resume state. Tracker issues remain the durable plan that other machines and people see.

## Shape

```markdown
# <objective, one line>

- Phase: context | design | issues | build | review | land | done | blocked
- Size: small | medium | feature
- Updated: <ISO time>, <branch> at <head SHA>, <worktree path>
- Next: <one concrete action>

## Context
What exists today and how it works, with file:line anchors.
Constraints: Preserve / Change / Avoid / Risk, from `why`.
Prior attempts that failed or were reverted, and why.

## Design
Data shape. The chosen design, and where its sketch and rationale live.
Rejected alternatives, one line each with the reason.
Grill answers, as the decisions the user made.

## Work
| Issue | Branch | PR | Head | Verification | State |

## Open
Unresolved decisions, blockers, and assumptions a fresh agent could get wrong.
```

## Rules

- **The bar.** A fresh agent that reads only this file and the files it anchors can continue at `Next` without re-running `recall`, `how`, `why`, or `teach`. Context and Design carry what this session learned that the code, issues, and PRs do not already say.
- **Rewrite sections, don't append.** The record is the current state, not a diary. A finished phase's section shrinks to what later phases still need.
- **Link, don't copy.** Issue URLs, PR URLs, the architect rationale, verification evidence paths.
- **Update at every phase boundary.** A usage limit can end the session without warning. The record should be at most one phase stale.
- **Check it after every write.** `node ~/.agents/skills/ship-record/scripts/ship-record.mjs <slug>` exits 1 on a missing field or an unknown phase or size, and reports whether the recorded branch still points at the recorded head. Fix what it reports before moving on.
- Never put a secret in it.
