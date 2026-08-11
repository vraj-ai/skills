# Matt Pocock skills — provenance

Tracked record of how `mattpocock/` is sourced from the upstream
`mattpocock/skills` repository. Update this file with every skill-tree sync.

## Source pin

- Repository: https://github.com/mattpocock/skills
- Release tag: `v1.2.3`
- Immutable commit (detached HEAD): `6acc160e4e0cd062dbbbd7a1b26ae92855edf07e`
- Author: Matt Pocock <mattpocockvoice@gmail.com>
- Committed: 2026-08-06 15:05:05 +0100
- Subject: Merge pull request #782 from mattpocock/changeset-release/main

The upstream tree under `skills/` was copied verbatim into `mattpocock/`
under the matching category directory. Upstream frontmatter (`name`,
`description`, `version`, `disable-model-invocation`, etc.) is preserved
without synthetic overlays; this repo does not inject its own per-skill
versions into upstream vendor content.

## Top-level vendor files

- `mattpocock/CHANGELOG.md` ← upstream `/CHANGELOG.md`
- `mattpocock/LICENSE`      ← upstream `/LICENSE`
- `mattpocock/UPSTREAM-README.md` ← upstream `/README.md` (renamed on
  import so it does not shadow this repo's own `README.md`)

## Synced categories (mirrored from `skills/<category>/`)

Each directory beneath the listed categories was copied wholesale,
including skill-local `agents/openai.yaml`, `scripts/`, and co-located
reference files (`*.md` resources). Byte-equal to the pinned commit.

- `engineering/` (18 skills + `README.md`) — ask-matt, code-review,
  codebase-design, diagnosing-bugs, domain-modeling, grill-with-docs,
  implement, improve-codebase-architecture, prototype, research,
  resolving-merge-conflicts, setup-matt-pocock-skills, tdd, to-spec,
  to-tickets, triage, wayfinder, **wizard**
- `productivity/` (7 skills + `README.md`) — grill-me, grilling, handoff,
  teach, **to-questionnaire**, **wait-what**, **writing-for-agents**
- `in-progress/` (7 upstream skills + upstream `README.md`,
  plus the retained local `batch-grill-me`) — claude-handoff, loop-me,
  setup-ts-deep-modules, writing-beats, writing-fragments, writing-shape
- `misc/` (4 skills + `README.md`) — git-guardrails-claude-code,
  migrate-to-shoehorn, scaffold-exercises, setup-pre-commit

## Renames and moves handled explicitly

Per `CONTEXT/architecture.md`: upstream renames and moves are handled
explicitly; absent upstream names are never silently deleted.

- **`writing-great-skills` → `writing-for-agents`** (rename, same
  `productivity/` bucket). The old `mattpocock/productivity/writing-great-skills/`
  directory was removed and replaced by `mattpocock/productivity/writing-for-agents/`
  copied from upstream. No synthetic version overlay; upstream frontmatter
  kept as-is.
- **`wizard` move**: `in-progress/` → `engineering/`. The old
  `mattpocock/in-progress/wizard/` directory was removed and replaced by
  `mattpocock/engineering/wizard/` copied from upstream (now a stable
  Engineering skill in v1.2.3).

## Local-only / retained skills (not overwritten)

These directories have no counterpart at the pinned upstream commit and are
intentionally preserved. They are not part of the upstream mirror and must
not be silently removed by a future sync.

### `personal/` (local-only, upstream has no `personal/` bucket)

- `personal/edit-article`
- `personal/obsidian-vault`

The local `personal/README.md` is retained; it has no upstream counterpart.

### `deprecated/` (retained deprecated Matt skills; upstream `deprecated/`
bucket is empty)

- `deprecated/design-an-interface`
- `deprecated/qa`
- `deprecated/request-refactor-plan`
- `deprecated/ubiquitous-language`

The local `deprecated/README.md` is retained (it lists the four retained
skills). Upstream's `deprecated/README.md` ("empty bucket") was not
copied, because it would contradict the retained skills that live here.

### `in-progress/batch-grill-me` (retained local-only)

`batch-grill-me` was vendored from an earlier Matt `in-progress` branch and
is **not** present in the v1.2.3 release `skills/` tree. It is retained
locally as a `local-only/deprecated Matt skill` per
`CONTEXT/architecture.md` ("Preserve local-only/deprecated Matt skills …
never silently delete absent upstream names"). The upstream
`in-progress/README.md` does not list it.

## Native workflow skills (out of scope for this sync)

This sync does **not** touch the vskills-native workflow skills: `goals/`,
`council/`, `council-adversary/`, `parallel/`, `push-handoff/`,
`opencode/`, `setup-obsidian/`, `setup-vskills/`, `loop-engineer/`,
`gauntlet-loop/`, `multi-agent-review/`, or the `pipeline/` runtime. Those
are governed by their own milestones (M2–M4).

## Verification

The repository's locked check `node --test 'test/*.test.js'` includes the
inventory test `test/mattpocock-inventory.test.js`, which re-derives the
expected upstream skill inventory from this pinned commit and asserts the
mirrored `mattpocock/` tree agrees, and that there are no duplicate
frontmatter `name`s across the vendored tree.