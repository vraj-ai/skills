# Frontmatter

## Sub-features

- Catalogue skills declare `name`, `description`, and semver `version`, and `name` matches the directory.
- This project-local skill declares `name` and `description`, and `name` matches `verify-skills`.

## How to get to it (user POV)

From the repository root, ask an agent to prove the skill library, or run the command below.

## Driving it with the validator

```bash
node scripts/validate-skills.mjs
```

A clean run prints `validate-skills: <count> skills, 0 violation(s)` and exits 0.

## Gotchas

A skill under `.cursor/skills/` is linted here and is not part of the vskills catalogue. `vskills init` does not install it.
