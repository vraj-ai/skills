# Cross-references

## Sub-features

- Relative markdown links inside each skill directory resolve to a file.
- The skill column of `route`'s intent table names only catalogue skills.

## How to get to it (user POV)

Same command as the frontmatter check. Link failures and unknown route targets are `cross-reference` violations.

## Driving it with the validator

```bash
node scripts/validate-skills.mjs
```

Then confirm the suite still agrees:

```bash
npm test
```

## Gotchas

pstack names (`poteto-mode`, `interrogate`, `how`, `why`, `recall`, `teach`, `architect`, `ketchup`, `setup-pstack`, `maintain-verification-skill`) are real skills in another package. A relative link to them, or a route-table cell that names one, is a failure. Mention them in prose beside the catalogue skill that owns the hand-off.
