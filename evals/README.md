# Skill evals

How this repo measures whether the skills actually work — that they are
well-formed, that they trigger when they should, and that they change agent
behavior the way each one promises.

Model test coverage before model choice: a skill that never triggers is dead
documentation no matter how good its prose is, and a skill that triggers for
every prompt routes nothing.

## The three tiers

| Tier | What it checks | Runs | Cost |
|---|---|---|---|
| 1. Structural | Frontmatter, name==dir, version, description budget, dependency closure, no retired-name invocations | CI (`scripts/validate-skills.mjs`, wired by `test/evals-structure.test.js`) | Free |
| 2. Routing | A natural prompt ranks the intended skill top-1; negative prompts don't rank a wrong-but-tempting skill top-1 | CI (`scripts/run-evals.mjs`, wired by `test/evals-routing.test.js`) | Free |
| 3. Behavioral | An agent following the skill satisfies its `expectations[]` | On demand (`scripts/run-evals.mjs --behavioral <skill>`) | Tokens |

Tier 2 is a lexical approximation of routing (IDF-weighted term overlap over
descriptions). It cannot judge semantics — Tier 3's job — but it catches the
two failures that dominate real trigger bugs: a description missing the
vocabulary users actually say (false negative), and an over-broad description
that outranks the right skill (false positive). A Tier-2 failure usually means
fix the description, not the eval.

## Running

```bash
node scripts/validate-skills.mjs            # tier 1
node scripts/run-evals.mjs                  # tier 2, all cases
node scripts/run-evals.mjs --verbose        # show the top-3 ranking per case
node scripts/run-evals.mjs --min-rank1 90   # relax the pass floor

# tier 3 — spends tokens, runs on demand only
node scripts/run-evals.mjs --behavioral ship --dry-run   # print the plan
node scripts/run-evals.mjs --behavioral ship             # run + grade
```

Tier 3 materializes `evals/behavioral/<skill>.json`: the skill's own SKILL.md
is prepended to the agent prompt (without it the run measures a generic agent,
not an agent following the skill), `setup_files` are written into a temp
workdir, the prompt goes to the agent command (`VSKILLS_EVAL_AGENT_CMD`,
default `claude -p`), and a grader call (`VSKILLS_EVAL_GRADER_CMD`, default
same) judges the transcript against each expectation and returns JSON. The run
prints PASS/FAIL per expectation and exits non-zero when any fail. The
transcript is kept for review; grade it by hand when no grader harness is
configured.

## Writing cases

Routing cases live in `evals/routing/cases.json`. Write the prompt the way a
user would actually type it — including the misspelling and the jargon — not
the way the description is phrased. A case that parrots the description tests
nothing. Negative cases (`"kind": "negative"`) name a skill that must NOT rank
top-1; use them for prompts that sit between two skills.

Behavioral cases live in `evals/behavioral/<skill>.json` with `prompt`,
`setup_files`, and `expectations[]`. Expectations are checkable claims about
the run ("opened a PR", "ran the verification command before editing"), not
vibes ("was thorough"). Pressure cases — time pressure, sunk cost, authority
pressure — are how discipline skills get verified; a skill that only holds when
nothing argues against it is prose, not a gate.
