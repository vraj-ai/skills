---
name: setup-vskills
version: 1.1.0
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

## Step 1.1 — Install the global OpenCode profile

Install the canonical agent and command files tracked under `opencode/`:

```bash
node setup-vskills/scripts/install-opencode.mjs
```

This installs selectable `goals` and read-only `council` primaries, the
contributor/council/adversary subagents, and `/goal` under
`~/.config/opencode/`. Goals remains the sole delivery/backlog authority inside
a goal run. Installation is idempotent. A differing existing file is moved to
`~/.config/opencode/.vskills-backup/` before replace.
It does not modify `opencode.json` or provider credentials.

## Step 2 — Regenerate CONTEXT.md

Write a fresh `CONTEXT.md` at the repo root by reading the actual code, not by
guessing. It must cover, briefly:

- What the repo is: a personal skills collection plus the `vskills` installer
  (`bin/vskills.js`, `src/`).
- The skill layout: category folders (e.g. `mattpocock/engineering/...`),
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
  observe (e.g. npx/GitHub distribution, CLI architecture). Number them
  `0001-...`, `0002-...`.

## Step 4 — Verify nothing leaks

```bash
git status --short
git check-ignore CONTEXT.md docs/invariants.md
```

Both paths must be ignored. If `git status` shows any of the regenerated docs
as untracked-and-addable, stop and fix `.gitignore` before committing
anything.

## Rules

- Never commit `CONTEXT.md`, `docs/`, `CONTEXT/`, or `CLAUDE.md` to this
  repo. They are local-only by design.
- Never edit installed copies under the install root — edit the repo source
  and re-run `node bin/vskills.js init`.
- Never edit the installed OpenCode agent copies directly — edit `opencode/`
  and rerun `install-opencode.mjs`.
- Bump the `version:` in a skill's frontmatter whenever you change its
  content; init uses versions to auto-resolve otherwise-ambiguous updates.
- Quit and restart OpenCode after installing; config-time files are loaded once.
