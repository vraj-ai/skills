---
name: verify-skills
description: Prove the vskills repository by linting every skill's frontmatter and relative cross-references, then running the test suite. Use before claiming this repo works, after a skill edit, or when a pull request needs verification evidence.
version: 1.1.0
---

# Verify skills

This repository is a skill catalogue and a Node installer. Proof is the command output, not a summary of it. Run both commands from the repository root. A non-zero exit is a failure. Paste the `validate-skills:` line and the test summary into the PR body.

Feature map: [frontmatter](features/frontmatter.md), [cross-references](features/cross-references.md), [routing](features/routing.md).

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

`poteto-mode`, `interrogate`, `how`, `why`, `recall`, `teach`, `architect`, `ketchup`, `setup-pstack`, and `maintain-verification-skill` are pstack skills. They are not catalogue entries, so `route` must not list them as its destination.

## Tests

```bash
npm test
```

`npm test` runs `scripts/run-tests.mjs`, including the structural and routing evals. A routing failure shows as one test line. Run `node scripts/run-evals.mjs --verbose` to see each miss.

On Windows without Developer Mode, three tests that create file symlinks fail with `EPERM`. That is the environment, not the change: confirm the failing names are only the symlink tests.

## Evidence

Keep both summaries. If either command fails, verification failed. Do not start a server. There is nothing to tear down.
