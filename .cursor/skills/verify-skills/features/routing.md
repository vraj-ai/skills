# Routing

## Sub-features

- Every case in `evals/routing/cases.json` ranks its expected skill top-1.
- Negative cases do not rank their named skill top-1.

## How to get to it (user POV)

`npm test` runs this as one test, "every routing case ranks its expected skill top-1". When it fails, that line is all you see. Drive the evals directly to find the miss.

## Driving it with the eval runner

```bash
node scripts/run-evals.mjs --verbose
```

A clean run ends `routing evals: <n>/<n> rank-1 (100%), floor 100%`. Each `MISS` line prints the top three skills with scores.

## Gotchas

Ranking is IDF-weighted word overlap across every catalogue description, so editing one skill's description can steal or lose cases for another. A word that becomes common across descriptions (`work`, `how`) weakens the skill that relied on it. Fix the description, not the case. Add a case when a description gains a new trigger.
