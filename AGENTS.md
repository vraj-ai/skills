# skills

vskills catalogue and installer for `vraj-ai/skills`. Node >= 18. `npm test` runs the suite. `node scripts/validate-skills.mjs` lints skill frontmatter and cross-references.

## Which skill

pstack `/poteto-mode` is the inner loop: understand, design, build, verify, interrogate, ship. Install pstack beside this catalogue. Do not copy it into the repo. These skills own the queue and delivery.

- Any task: `/ship`. A feature runs `/recall`, `/how` and `/why`, `/teach`, `/architect`, `/grill` for product questions, and `/issues` inside `/ship`, builds with `/poteto-mode`'s Feature or Bug-fix playbook, proves the change with the repo's `verify-<app>` skill, and hands off to `/land`. A small change goes straight to the build.
- Product questions only: `/grill`. Agreed work to queue without building: `/issues`. When a repo has a `verify-<app>` skill, name that feature in Verification.
- Stopping before done: `/snapshot` completes the ship record (`$(git rev-parse --git-common-dir)/vskills/ship/<slug>.md`, never committed). `/resume-work` continues at its phase. An in-chat catch-up maps to pstack `/ketchup`.
- Merge is `/land`, and only with explicit authority. Self-merge is off (fleet ADR 0003).

`/route` maps an intent to one of these. It must not send the same request to both `/ship` and `/poteto-mode`.

## Verify

Before claiming this repo works, run `.cursor/skills/verify-skills`: `node scripts/validate-skills.mjs`, then `npm test`. Paste both summaries. A model verdict is not a pass.

## Tracker and context

GitHub Issues on `vraj-ai/skills` via `gh`. This repo does not commit `docs/` or `CONTEXT/` (see `setup-vskills`). Consumer projects keep durable decisions in their own `CONTEXT/architecture.md`.

## Authority

Do not merge, force-push `main`, or commit secrets. Opening a PR is the delivery.
