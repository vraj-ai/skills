---
name: setup-vskills
version: 1.11.0
description: Sets up this skills repo on a new machine — installs the skills with the vskills CLI, then regenerates the local-only context docs (CONTEXT.md, docs/) that are deliberately not published in the public repo.
---

# Setup vskills

This public repo ships the skills and the `vskills` CLI, but **not** the
model-context docs. `CONTEXT.md`, `docs/`, `CONTEXT/`, and `CLAUDE.md` are
gitignored on purpose: they are local working notes for coding agents, and
they go stale against a fork faster than against the source tree. Your job is
to install the skills and then rebuild those docs *from this clone*.

## Step 1 — Install the skills

```bash
node bin/vskills.js init
```

- Init classifies every skill as install / up-to-date / adopt / update /
  conflict. Adopts are silent (byte-identical copies become managed).
- On conflicts, the CLI prompts. Anything overwritten is backed up to
  `<install-root>/.vskills-backup/<name>-<timestamp>` — never deleted.
- Re-running init is a no-op; use it freely to verify.

Confirm with `node bin/vskills.js list` and run the test suite once:
`node --test 'test/*.test.js'` — everything should pass before you write docs.

## Step 1.1 — Research the current harness and install integration templates

Ask the user which coding agent harness is in use (e.g. omp, OpenCode, Claude Code, Codex, Cursor, etc.). Always research that harness's agent configuration and integration model first — there is no hardcoded allowlist that skips research.

Install the tightest integration for `grill`, `issues`, `ship`/`goals`, and `snapshot`:

```bash
node standalone/setup-vskills/scripts/install-harness.mjs <harness>
```

- **omp**: The installer copies the 10 canonical Role templates from `harness/omp/agent/` into `~/.omp/agent/agents/` (or `$OMP_AGENTS_DIR` when set for test isolation). This installs invocation templates (`grill`, `issues`, `ship`, `goals`, `snapshot`) and worker templates (`researcher`, `builder`, `reviewer`, `adversary`, `small-task`). You can also run `node standalone/setup-vskills/scripts/install-omp.mjs`.
- **OpenCode**: The installer reads canonical agent and command files from `harness/opencode/` into `~/.config/opencode/` (or `$OPENCODE_CONFIG_DIR`). This installs selectable `goals` and read-only `council` primaries, the contributor, cost-aware Gemini/DeepSeek, council, and adversary subagents, and `/goal`. Goals remains the sole delivery/backlog authority inside a goal run. You can also run `node standalone/setup-vskills/scripts/install-opencode.mjs`.
- **Any other harness**: The installer does not research and does not claim it did. You research how the harness defines agent roles, custom commands, prompt templates, and subagents. Write an integration plan mapping `grill`, `issues`, `ship`/`goals`, and `snapshot` to that harness. Never fail with an 'unknown harness' error from an allowlist.

All template installations are atomic and idempotent. Differing existing files are moved to `.vskills-backup/` before replace. It does not modify credentials or core configuration files.

## Step 1.1.1 — Optional: install the PR review bot (Greptile parity)

When setting up a consumer project (not this repo), offer the polished PR review bot:

```bash
node standalone/pr-review/scripts/copy.mjs [project-root]
# or via the setup helper:
node standalone/setup-vskills/scripts/copy-pr-review.mjs [project-root]
```

Interactive prompt (ask, don't assume):
- "Install PR review bot? [y/N]" — default no.
- If yes, ask model wiring: provider `none` (deterministic only) | `openai` | `anthropic` | `compat`, auth `apikey` | `oauth` | `none`, `baseUrl`, `model`, `secretName` (default `OPENROUTER_API_KEY`). Write choice into `.vskills/review.yml` (never store the secret value). Show next step: "Add OPENROUTER_API_KEY as a repo secret, set vars.REVIEW_MODEL / vars.REVIEW_API_BASE, and push a PR to test".
- Copy is atomic, backs up existing workflows to `.vskills-backup/`, also installs `.vskills/pr-review/` prompts and parsers, is idempotent, and does not overwrite an existing `.vskills/review.yml`.

Templates live in `standalone/pr-review/templates/` and carry `<!-- vskills-pr-review -->` for idempotent upserts. Verify with `node --test 'test/pr-review-*.test.js' 'test/setup-pr-review.test.js'`.

## Step 1.2 — Bootstrap the project agent architecture

Run this from the root of the project being set up:

```bash
node "$HOME/.agents/skills/setup-vskills/scripts/init-context.mjs"
```

The initializer creates missing files only:

- `AGENTS.md` — the always-loaded project router.
- `CONTEXT/architecture.md` — human-owned purpose, locked decisions, invariants,
  non-goals, accepted boundaries, and ownership.
- `CONTEXT/progress.md` — the bounded derived milestone pointer.

It also adds only goal runtime paths to `.gitignore`. It never overwrites an
existing `AGENTS.md`, architecture, progress, or project decision. It does not
create a goal backlog; `/goals` creates `CONTEXT/goals/<slug>/` when a plan runs.

## Step 2 — Regenerate CONTEXT.md

Write a fresh `CONTEXT.md` at the repo root by reading the actual code, not by
guessing. It must cover, briefly:

- What the repo is: a personal skills collection plus the `vskills` installer
  (`bin/vskills.js`, `src/`).
- The skill layout: root skill folders and nested category folders,
  each skill a directory with a `SKILL.md` whose frontmatter has `name`,
  `version`, `description`, and optional `dependencies`.
- The install model: skills are copied into an install root, agent targets
  get symlinks, and `.vskills-manifest.json` records `sourcePath`,
  `contentHash`, `installedAt` per skill.
- Drift rules: a copy whose hash doesn't match the manifest is "drifted" and
  never overwritten without `--force`; forced overwrites of unmanaged content
  are backed up first.
- How to run tests and where they live (`test/*.test.js`, node:test, no
  external dependencies).

Keep it under ~100 lines. If a claim can't be verified in the source, leave
it out.

## Step 3 — Regenerate docs/

Recreate `docs/` with:

- `docs/invariants.md` — the safety rules the code enforces (atomic replace,
  backup-before-destroy, symlink-never-clobber, manifest-is-source-of-truth).
  Derive each one from `src/install.js` and the tests that pin it.
- `docs/spec-vskills-cli.md` — command-by-command behavior of `init`, `add`,
  `list`, `update`, taken from `src/commands/`.
- `docs/adr/` — one short ADR per structural decision you can actually
  observe (e.g. npm registry distribution as `vskills`, CLI architecture). Number them
  `0001-...`, `0002-...`.

## Step 4 — Verify nothing leaks

```bash
git status --short
git check-ignore CONTEXT.md docs/invariants.md
```

Both paths must be ignored. If `git status` shows any of the regenerated docs
as untracked-and-addable, stop and fix `.gitignore` before committing
anything.

## Tracker closeout review

After setup verification, if `docs/agents/issue-tracker.md` exists, write one review through that tracker using its commands. Read issues, pull requests, and commits this session produced or touched. Post one comment on the parent spec or open PR (GitHub: `gh issue comment` / `gh pr comment`). Cover what was installed, remaining follow-ups, and any contradiction with `CONTEXT/`. Do not create tickets. Do not rotate `goals:*` labels. If the tracker file is missing, skip and say so.

## Session handoff

`setup-vskills` owns installation, the initial project agent architecture, and
this repository's local regenerated docs. When setup work must continue in
another session, write a full sectioned handoff to `$TMPDIR` after
verification, then deliver it with `/push-handoff` if it must reach the remote.

## Durable context contract

This repository keeps its own machine-local working notes — `CONTEXT.md`,
`docs/`, `CONTEXT/`, and `CLAUDE.md` — local-only under **this repo's own
`.gitignore`**. They are a property of the public vskills repository, not a
universal rule about consumer projects: the `vskills` CLI never writes them
into a consumer repo, there is no `vskills docs-init` command, and the CLI
never infers a consumer project's context. Each consumer project owns its own
durable context.

Consumer projects that adopt `goals`/`council` track only these artifacts as
durable context:

- Uppercase `AGENTS.md` — the always-loaded router (human-owned).
- `CONTEXT/architecture.md` — durable intent, locked decisions, non-goals, and
  accepted boundaries (human-owned).
- Bounded derived `CONTEXT/progress.md` — a small pointer to the current
  milestone and last verified edit; never a diary, narrative, or resume source
  of truth (`goals`-owned, event-driven).
- `CONTEXT/goals/<slug>/handoff.md` and `reviews/M<n>.json`, `reviews/T3.json`
  — the goal resume and review verdicts (`goals`-owned, event-driven).

Only the runtime paths beneath a consumer `CONTEXT/` are ignored there:
`CONTEXT/goals/<slug>/backlog.jsonl` (goal resume state owned solely by
`goals`), `lock.d/`, `CONTEXT/worktrees/<slug>/`, `*.log`, `results.json`,
and `<id>.digest.json`. The tracked artifacts above are not ignored. Do not
apply this repo's own `.gitignore` (which hides the whole `CONTEXT/` of the
vskills repository) to a consumer project — a consumer's tracked
`CONTEXT/architecture.md`, `CONTEXT/progress.md`, and goal handoff would
become invisible.

Ownership rules carry across skills:

- **One owner per artifact.** No shared writers.
- **Event-driven updates only.** Rewrite an artifact when its trigger fires —
  a locked decision changes, a milestone completes, a T1/T3 verdict lands, or a
  clean stop checkpoints the handoff. No polling, no autonomous broad rewrites,
  no speculative refresh of the whole context tree.
- **Evidence over prose.** Progress and handoff entries point at tests, builds,
  review verdicts, or commits — never narrative.
- **Bounded context.** `CONTEXT/progress.md` stays a derived pointer; backlogs
  and handoffs remain the goal resume.
- **`goals` is the sole writer of goal state** (backlog, handoff, progress
  pointer, review verdicts). `council` is read-only and reports documentation
  impact only; it never edits a context artifact or the backlog.

## Rules

- Never commit `CONTEXT.md`, `docs/`, `CONTEXT/`, or `CLAUDE.md` to this
  repo. They are local-only by design.
- Never edit installed copies under the install root — edit the repo source
  and re-run `node bin/vskills.js init`.
- Never edit installed harness agent/role copies directly — edit `harness/<harness>/`
  and rerun the installer (`install-harness.mjs`, `install-omp.mjs`, or `install-opencode.mjs`).
- Bump the `version:` in a skill's frontmatter whenever you change its
  content; init uses versions to auto-resolve otherwise-ambiguous updates.
- Quit and restart the harness (e.g. OpenCode or omp) after installing; config-time files are loaded once.
