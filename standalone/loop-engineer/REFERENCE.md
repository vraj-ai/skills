# Loop Engineering — Reference

Background and templates for the `loop-engineer` skill. Source: *The Art of Loop Engineering*, Sydney Runkle / LangChain (June 2026).

## The four-loop stack

Loop engineering ("loopcraft") is stacking feedback loops around an agent. Each loop wraps the one before it.

| Loop | What it adds | In Claude Code terms |
|------|--------------|----------------------|
| **1. Agent loop** | A model calling tools in a loop until a task is complete. | The base session — Claude reading, editing, running commands. |
| **2. Verification loop** | A checker reviews output against a rubric; failures go back to the maker with feedback. Trades latency for reliability. | The maker→checker loop in `SKILL.md`. Prefer a separate top-level stage-parent session (or a one-level child of that parent) as the checker for true fresh-eyes reviewing; native children must not spawn nested children. |
| **3. Event-driven loop** | The agent runs on triggers (cron, webhook, message) instead of manual invocation. | The `/loop` and `/schedule` skills, or `ScheduleWakeup`. |
| **4. Hill-climbing loop** | Production traces feed an analysis pass that improves the harness (prompts, tools, rubric). Compounding gains. | Post-run: update the rubric, add the missing test, write a memory/skill. |

Human oversight is preserved at every level: sensitive tool calls need approval, the checker can be a human, and harness changes flow through review before taking effect.

## Why the maker/checker split matters

A model reviewing its own work is biased toward declaring success. Reliability comes from separating the role that *produces* from the role that *judges*:

- **Maker** — optimizes for progress toward the goal. Writes the test, makes the change.
- **Checker** — optimizes for catching failure. Re-runs the done-condition command, re-reads the actual diff, reviews against the rubric, and returns either PASS or a list of specific failing bullets with a concrete next action.

For high-stakes loops, make the checker a *separate context* (a sub-agent or `/code-review`) so it can't see the maker's reasoning and inherit its blind spots.

## Loop contract template

Paste this at the top of working notes before coding:

```md
## Loop contract
- Goal: <one sentence, user-visible outcome>
- Done-condition: <command that must exit 0 / return expected output>
    e.g. `npm test -- profile.spec.ts && tsc --noEmit`
- Rubric:
  - [ ] Done-condition passes
  - [ ] Handles the obvious edge cases (empty, null, error path)
  - [ ] No regressions in adjacent code
  - [ ] Matches existing patterns/naming in the file
  - [ ] No debug logs, commented code, or TODOs left behind
- Budget: 5 iterations. On exhaustion: stop, report the blocking failure, do not thrash.
```

## Worked example (bug fix)

```
Goal: "Family roster shows paid-tier members on the home screen."
Done-condition: `npm test -- roster.spec.ts` exits 0.

Iter 1  MAKER  : write failing test asserting paid members render → fails (red)
        MAKER  : add tier filter fix
        RUN    : npm test -- roster.spec.ts → 1 failing (off-by-one in filter)
        CHECKER: FAIL — test red; filter excludes the boundary tier. Next: include tier === 'paid'.
Iter 2  MAKER  : fix boundary
        RUN    : npm test -- roster.spec.ts → green
        CHECKER: re-reads diff, re-runs → PASS, rubric satisfied. Exit.
Hill-climb: add the boundary case to the shared roster fixture so future loops catch it.
```

## When NOT to loop

- Trivial one-line changes where a checker pass costs more than the change.
- Tasks with no checkable done-condition that the user won't let you make checkable — ask first.
- Exploratory/throwaway work — use `prototype` instead.
