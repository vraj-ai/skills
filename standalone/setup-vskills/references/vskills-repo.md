# Local docs for the vskills repo itself

Only when the project being set up is a clone of `vraj-ai/skills`. This repo
ships the skills and the CLI but not its model-context docs: `CONTEXT.md`,
`docs/`, `CONTEXT/`, and `CLAUDE.md` are gitignored because they go stale
against a fork faster than against the source. Rebuild them from this clone.
Never commit them.

## 1 — Regenerate CONTEXT.md

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

## 2 — Regenerate docs/

Recreate `docs/` with:

- `docs/invariants.md` — the safety rules the code enforces (atomic replace,
  backup-before-destroy, symlink-never-clobber, manifest-is-source-of-truth).
  Derive each one from `src/install.js` and the tests that pin it.
- `docs/spec-vskills-cli.md` — command-by-command behavior of `init`, `add`,
  `list`, `update`, taken from `src/commands/`.
- `docs/adr/` — one short ADR per structural decision you can actually
  observe (e.g. npm registry distribution as `vskills`, CLI architecture). Number them
  `0001-...`, `0002-...`.

## 3 — Verify nothing leaks

```bash
git status --short
git check-ignore CONTEXT.md docs/invariants.md
```

Both paths must be ignored. If `git status` shows any of the regenerated docs
as untracked-and-addable, stop and fix `.gitignore` before committing
anything.

