---
name: gauntlet-loop
description: Run or generate a gauntlet loop for one-shot prompts, UI work, writing, research, and implementation. Use when the user says gauntlet, beat this reference, polish until better, make a one-shot prompt, compare against a real product, or loop with a harsh critic.
---

# Gauntlet Loop

Turn a goal into a closed maker → critic loop with a real external quality bar. The
critic is separate, binary, and allowed to say the work loses. Never call a green
maker pass a win.

## Choose a mode

- **Prompt mode:** the user wants a paste-ready one-shot prompt. Generate the prompt;
  do not do the work.
- **Run mode:** the user says build, implement, polish, or run it. Execute the loop
  in the current task.
- **UI mode:** any frontend, UI, visual, interaction, or design task. Apply the UI
  checks below in either mode.

If mode or the goal is genuinely unclear, ask one short question. Do not ask about
architecture before the bar is chosen.

## Set the bar first

If the user supplied a reference, use it. Otherwise offer **2–3 candidates and stop**.
A valid bar is:

1. **Named** — a specific page, product, repository, paper, post, or artifact.
2. **Fetchable** — the critic can actually open, run, read, or screenshot it.
3. **Comparable** — both outputs share a format, viewport, length, or benchmark.

For code or tooling, pair the reference with a measurable check when one exists.
Never invent a vague bar such as “best-in-class.” Do not copy proprietary code or
content; compare qualities and behavior.

## Lock the loop contract

Before making changes, write or state:

- **Goal:** the user-visible outcome.
- **Bar:** the exact reference and how it will be obtained.
- **Comparison unit:** the slice being judged.
- **Done condition:** a runnable command, test, benchmark, screenshot check, or
  explicit artifact check. Visual work needs real screenshots at matching viewports.
- **Rubric:** correctness, bar comparison, edge cases, accessibility/safety, and no
  regressions or debug cruft.
- **Budget:** 5 maker/critic attempts by default. Exhaustion is an honest blocker,
  never a pass.

## Prompt mode

Return one paste-ready prompt, about 120–180 words, with no narration inside it. It
must say: build the goal; fetch and compare against the bar directly; split into
small judgeable slices; use a fresh builder and critic for each; have the critic
remove labels, choose which output is better, and name the single biggest gap; fix
that gap and repeat until ours wins; and run the done condition. Add available
browser, screenshot, preview, or native-subagent tools only when the goal needs them.
End outside the block with: `I can run this here.`

## Run mode

1. Make the smallest useful slice.
2. Have the maker implement it test-first where code or behavior is involved.
3. Run the mechanical done condition after the final edit.
4. Give only the goal, bar, output, gate result, and rubric to a fresh critic. Do not
   give the maker's rationale or self-assessment.
5. The critic returns `PASS` only when ours wins the blind comparison and the gate is
   green; otherwise it returns one falsifiable biggest gap and the next edit.
6. Fix that gap, rerun the gate, and repeat. The critic does not edit or approve its
   own work. Stop at the budget and report the blocker.

Use separate native subagent/context for the critic when available. If that is not
possible, disclose that the review is same-context and lower-confidence.

## UI mode

Use the project's existing styling and preview tools. Compare screenshots at the same
viewport and also check mobile when relevant. Judge only what is visible and usable:
layout hierarchy, spacing and concentric radii, typography and wrapping, contrast,
40px desktop / 44px touch targets, responsive states, loading/empty/error states,
keyboard and screen-reader access, reduced motion, and interaction feedback. Load
`better-ui` and `better-typography` when available. A visual win never excuses broken
functionality, validation, accessibility, security, or data-loss protection.

## Exit rule

Win means: the critic picks ours, the done condition passes after the final edit, and
no safety or accessibility requirement is missing. If the bar is unreachable or
unfetchable, stop and ask for a better bar instead of pretending to compare.
