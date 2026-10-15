---
name: verify-skills
description: Prove the vskills repository by linting every skill's frontmatter and relative cross-references, then running the test suite. Use before claiming this repo works, after a skill edit, or when a pull request needs verification evidence.
version: 1.0.1
---

# Verify skills

This repository is a skill catalogue and a Node installer. Proof is the command output, not a summary of it. Run both commands from the repository root. A non-zero exit is a failure. Paste the `validate-skills:` line and the test summary into the PR body.

Feature map: [frontmatter](features/frontmatter.md), [cross-references](features/cross-references.md).

## Frontmatter and cross-references

```bash
node scripts/validate-skills.mjs
```

That command lints every catalogue skill and this skill:

- frontmatter parses, with `name`, `description`, and, for catalogue skills, a semver `version`
- `name` matches the directory
- the description stays inside the routing budget
- every `dependencies` entry names a catalogue skill
- every relative markdown link inside a skill directory resolves
- every skill named in `route`'s intent table is a catalogue skill
- the body does not invoke a retired skill name

`poteto-mode`, `interrogate`, `how`, `architect`, and `ketchup` are pstack skills. They are not catalogue entries, so `route` must not list them as its destination.

## Tests

```bash
npm test
```

`npm test` runs `scripts/run-tests.mjs`, including the structural and routing evals.

## Evidence

Keep both summaries. If either command fails, verification failed. Do not start a server. There is nothing to tear down.
