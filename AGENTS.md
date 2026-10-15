# skills

vskills catalogue and installer for `vraj-ai/skills`. Node >= 18. `npm test` runs the suite. `node scripts/validate-skills.mjs` lints skill frontmatter and cross-references.

## Which skill

pstack `/poteto-mode` is the inner loop: understand, design, build, verify, interrogate, ship. Install pstack beside this catalogue. Do not copy it into the repo. These skills own the queue and delivery.

- Unclear product intent: `/grill`. An architecture fork goes to pstack `/how` and `/architect`. A contested design can hand off to `/interrogate`.
- Agreed work into the tracker: `/issues`. When a repo has a `verify-<app>` skill, name that feature in Verification.
- Build and open a PR: `/ship`. Multi-module work, a design fork, or an unknown cause during the build runs `/poteto-mode`'s Feature or Bug-fix playbook inside `/ship`. A one-file change stays plain `/ship`.
- Unfinished work for a later session: `/snapshot` (branch, head SHA, next action). An in-chat catch-up maps to pstack `/ketchup`.
- Merge is `/land`, and only with explicit authority. Self-merge is off (fleet ADR 0003).

`/route` maps an intent to one of these. It must not send the same request to both `/ship` and `/poteto-mode`.

## Verify

Before claiming this repo works, run `.cursor/skills/verify-skills`: `node scripts/validate-skills.mjs`, then `npm test`. Paste both summaries. A model verdict is not a pass.

## Tracker and context

GitHub Issues on `vraj-ai/skills` via `gh`. This repo does not commit `docs/` or `CONTEXT/` (see `setup-vskills`). Consumer projects keep durable decisions in their own `CONTEXT/architecture.md`.

## Authority

Do not merge, force-push `main`, or commit secrets. Opening a PR is the delivery.
