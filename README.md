# vskills

**Agent skills that run software work as a pipeline, not a conversation.**

[![npm](https://img.shields.io/npm/v/@vskills/cli?label=%40vskills%2Fcli)](https://www.npmjs.com/package/@vskills/cli)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)

Coding agents are fast. They are also confident, forgetful, and happy to grade
their own homework. These skills put an engineering process around them: settle
what to build, queue it with a verification command, build it, have a context
that didn't write the code review it, and merge only with your say-so.

A skill is a `SKILL.md` an agent loads on demand that says how to do one job
properly. These work in any harness that can load one (Claude Code, omp,
OpenCode, Pi, Codex, Cursor, T3 Code) with any model. `vskills` is the
zero-dependency installer that puts them on your machine.

```
   /grill          /issues            /ship               /land
 ┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌────────────┐
 │ Settle  │ ──▶ │ Queue it │ ──▶ │ Build, prove│ ──▶ │ Checks,    │
 │ intent  │     │ with a   │     │ review, open│     │ threads,   │
 │         │     │ verify   │     │ a PR        │     │ merge      │
 └─────────┘     └──────────┘     └─────────────┘     └────────────┘
   optional        optional               │              explicit
                                          ▼              authority
                              /snapshot ─────▶ /resume
                              pause here      pick up later
```

## Quick start

**1. Install.** Same command on macOS, Linux, and Windows PowerShell:

```
npx @vskills/cli init
```

**2. Set up your machine.** In your agent, run `/setup-vskills` once. It
installs the skills, wires your harness, and configures pstack's model routing.

**3. Ship something.**

```
/ship #123
```

A clear task goes straight to `/ship`. Use the other stages only when the task
needs them. Not sure where to start? `/route` reads what you're trying to do
and hands back the invocation.

## The workflow

| Skill | Use it for |
|---|---|
| `/route` | Unsure which skill fits. Maps intent to an invocation |
| `/grill` | Consequential product or design choices when intent is unclear |
| `/issues` | A durable work queue with acceptance, references, and verification |
| `/ship #123` | Find or execute work, verify behavior, get it reviewed, open a PR |
| `/land` | Drive open PRs to merged: checks, threads, stacks, verified runs |
| `/snapshot` | A short resume note for unfinished work |
| `/resume` | Pick up where a prior session or agent stopped, from the proven position |

Issues and PRs hold intent and shared status. Source and checks establish
behavior. Small decision docs preserve rationale.

### With pstack

[pstack](https://github.com/cursor/plugins/tree/main/pstack) is the inner
engineering loop: understand, design, build, verify, interrogate. Install it
beside this catalogue; it is not copied into it. These skills own the queue
and the delivery around it.

- A one-file change is plain `/ship`.
- Work that crosses modules, has a design fork, or still has an unknown cause
  runs `/poteto-mode`'s Feature or Bug-fix playbook inside `/ship`.
- `/grill` keeps product questions. An architecture fork goes to `/how` and
  `/architect`. A contested design can hand off to `/interrogate`.
- `/snapshot` maps to `/ketchup` for an in-chat catch-up. The resume note
  (branch, head SHA, next action) stays `/snapshot`.
- Merging is `/land`, and only with explicit authority. Self-merge is off.

## Why these exist

Each rule below fixes a failure you hit the moment an agent runs unsupervised.
Most are small principle skills the delivery skills invoke, so you can pull
any of them into your own workflow.

### "Done." It isn't.

**Check the real artifact.** Run the feature, read the actual value, inspect
the diff. A build pass, an HTTP 200, or a summary that says "all tests pass" is
a proxy. Every queued task carries a Verification-command, and `/ship` runs it
after the final edit. *(`principle-real-artifact`)*

### The agent reviewed its own code and loved it.

**Only an independent verdict counts.** The author checks what it meant to
build, not what it built. Review comes from a context that didn't write the
code: your PR bot, a configured reviewer, or pstack's `/interrogate`. A verdict
applies to the head SHA it examined, so a push means a recheck.
*(`principle-independent-verdict`)*

### The tracker says done. Nothing landed.

**The repo beats the report.** When a worker claims success with no commit, or
a ticket says done while the gate is red, the repo is right and the report is
narrative. `/resume` verifies every claim a prior session left before building
on it. *(`principle-evidence-over-report`)*

### It retried the same fix eleven times.

**Bound every repair loop.** Retrying an identical failure the same way spends
budget and learns nothing. Set the budget first, change the hypothesis when a
retry fails the same way twice, and report a blocker when the budget runs out
instead of weakening acceptance. *(`principle-bounded-repair`)*

### It pushed to a branch it wasn't allowed to touch.

**Name every constraint up front.** Budget, spend authority, git authority,
tracker access, time, and how far the current state can be trusted. An unnamed
constraint gets violated; a named one picks the path.
*(`principle-named-constraints`)*

### An 800-line diff for a 20-line problem.

**The ladder.** Stop at the first rung that solves it: does it need to exist,
is it already in the codebase, stdlib, native platform, an existing dependency,
one line, then the minimal implementation. Input validation, error handling,
security, and accessibility are never on the chopping block. *(`ponytail`)*

### "I pushed it." Did you?

**Handoff is not delivery.** `push-handoff` is the explicit delivery step: it
verifies, commits, pushes, and reads the fetched remote SHA back as proof, and
only when delivery is authorized. `/snapshot` checkpoints but grants no push
authority. Opening a PR is `/ship`'s delivery; merging is `/land`'s, and only
when you say so.

## The skills

Install any one with its dependencies: `npx @vskills/cli add <skill>`.

**Delivery**

| Skill | Use when |
|---|---|
| [`ship`](delivery/ship/SKILL.md) | A task, ticket, or issue goes in; a verified, reviewed PR or an evidenced blocker comes out |
| [`land`](delivery/land/SKILL.md) | Open PRs need driving to merged. Lands only the contiguous verified run, bottom-up |

**Standalone**

| Skill | Use when |
|---|---|
| [`route`](standalone/route/SKILL.md) | You don't know which skill fits; it hands back an invocation |
| [`grill`](standalone/grill/SKILL.md) | Intent is unclear and the choice is consequential |
| [`issues`](standalone/issues/SKILL.md) | An agreed outcome becomes tracker work with acceptance and verification |
| [`investigate`](standalone/investigate/SKILL.md) | You want a read-only answer about the codebase, with file pointers and confidence |
| [`debug`](standalone/debug/SKILL.md) | A bug or regression has an unknown cause. Reproduce, isolate, fix at the cause |
| [`snapshot`](standalone/snapshot/SKILL.md) | Work is unfinished and a later session needs a resume note |
| [`resume`](standalone/resume/SKILL.md) | A prior session or agent left work in flight |
| [`push-handoff`](standalone/push-handoff/SKILL.md) | Commit and push under explicit authority, proven by remote SHA |
| [`ponytail`](standalone/ponytail/SKILL.md) | You want the laziest solution that actually works |
| [`setup-vskills`](standalone/setup-vskills/SKILL.md) | Setting this up on a new machine |
| [`setup-obsidian`](standalone/setup-obsidian/SKILL.md) | A docs folder should become a retrieval graph and Obsidian vault |
| [`pr-review`](standalone/pr-review/SKILL.md) | You want a GitHub Actions PR review bot: summary, confidence, checks, fix-on-comment |
| [`test-tps`](standalone/test-tps/SKILL.md) | Benchmarking a Pi model: TTFT, decode and average TPS, usage, cost, percentiles |

**Pipeline**: disciplines you can pull in on their own.

| Skill | Use when |
|---|---|
| [`audit`](pipeline/audit/SKILL.md) | A whole codebase, not a diff, needs a ranked backlog of tickets |
| [`implementation-tdd`](pipeline/implementation-tdd/SKILL.md) | One ticket, test-first, at the seam production actually uses |
| [`subagent-delegation`](pipeline/subagent-delegation/SKILL.md) | Fanning work out with disjoint lanes and the parent as sole gatekeeper |
| [`delivery-constraints`](pipeline/delivery-constraints/SKILL.md) | Budget, live data, git authority, or a lying tracker decides how work ships |
| [`ai-subscription-unit-economics`](pipeline/ai-subscription-unit-economics/SKILL.md) | Pricing and usage caps for a product whose cost of goods is inference |

**Principles**: invoked by the delivery skills, not entry points.

| Skill | The rule |
|---|---|
| [`principle-real-artifact`](principles/principle-real-artifact/SKILL.md) | Verify against the real thing, never a proxy |
| [`principle-independent-verdict`](principles/principle-independent-verdict/SKILL.md) | Only a context that didn't write the code can pass it |
| [`principle-evidence-over-report`](principles/principle-evidence-over-report/SKILL.md) | When the repo and the report disagree, the repo wins |
| [`principle-bounded-repair`](principles/principle-bounded-repair/SKILL.md) | Budget the fix loop; escalate instead of retrying blind |
| [`principle-named-constraints`](principles/principle-named-constraints/SKILL.md) | Name every constraint before starting |

`ponytail` is vendored from DietrichGebert/ponytail (MIT, pinned to v4.9.0).
See [VENDORED.md](VENDORED.md) for provenance.

### Evals

Skill quality is tested, not asserted. [`evals/`](evals/README.md) runs three
tiers: structural validation and prompt-to-skill routing in CI, plus behavioral
evals on demand that check an agent following the skill actually does what it
promises.

```bash
node scripts/validate-skills.mjs   # tier 1: frontmatter and cross-references
node scripts/run-evals.mjs         # tier 2: does the right skill trigger?
```

## Skills from elsewhere

Pinned copies live under [`third-party/`](third-party/). They are not part of
the vskills catalogue: `vskills init` and `vskills add` do not install them.
Provenance and commits are in [VENDORED.md](VENDORED.md).

| Pack | Path | Source |
|---|---|---|
| Matt Pocock | `third-party/mattpocock/skills` | [mattpocock/skills](https://github.com/mattpocock/skills) |
| Addy Osmani | `third-party/addyosmani/skills` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) |
| Frontend design | `third-party/frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) `frontend-design` |

**Claude Code plugins** install through `/plugin`, not `vskills`. Useful
companions from the
[official marketplace](https://github.com/anthropics/claude-plugins-official):
`superpowers` (brainstorming, TDD, systematic debugging, worktrees),
`skill-creator`, and `frontend-design`. The
[ponytail](https://github.com/DietrichGebert/ponytail) plugin is optional,
since the skill is already vendored here.

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

## Agents and Roles

The author runs this workflow in omp. The skills stay harness-agnostic: any
client that can load a `SKILL.md` can run them, with any model.

`/setup-vskills` writes Invocation Roles (`grill`, `issues`, `ship`,
`snapshot`) and Worker Roles (`researcher`, `builder`, `reviewer`, `adversary`,
`small-task`) from `harness/` into the harness it researched. Workers never
spawn. The Invocation Role is the only writer of shared status, locks, and
push. Role templates leave model and effort unset; assign those in your
harness. Inside T3 Code, `/ship` uses native child tasks, PR links and
watches, and browser evidence.

## Installing with `vskills`

Zero runtime dependencies, Node 18 or newer.

```bash
npx @vskills/cli init                    # install the recommended set (default)
npx @vskills/cli init --recommended      # exactly the recommended set, dropping anything else
npx @vskills/cli init --all              # install every skill
npx @vskills/cli init --only ship,grill  # install exactly these skills
npx @vskills/cli list                    # what is installed, what has drifted
npx @vskills/cli add <skill>             # one skill plus its dependencies
npx @vskills/cli update [skill...]       # refresh, skipping your local edits
```

The recommended set is `ship`, `grill`, `issues`, `snapshot`,
`setup-vskills`, and `ponytail`, plus `push-handoff` as a dependency of
`snapshot`: seven skills, and everything the workflow above needs. On a TTY,
`init` shows that set and offers to accept it (plain Enter), install
everything, or pick names. `--yes` and non-TTY runs take the recommended set
without asking.

**Your edits are safe.** A skill whose content hash no longer matches the
manifest is marked `drifted` and left alone. Only `--force` overwrites it, and
it backs the old copy up to `~/.agents/skills/.vskills-backup/` first. Copies
stage in a temp dir and swap in with `rename`, so an interrupted install can't
leave half a skill behind. Every guarantee here is pinned by a test in
[`test/`](test/), which ships in the package.

Content is copied to an install root and linked into each agent's skills
directory:

| | install root | Claude Code target |
|---|---|---|
| macOS / Linux | `~/.agents/skills/<name>` | `~/.claude/skills/<name>` |
| Windows | `%USERPROFILE%\.agents\skills\<name>` | `%USERPROFILE%\.claude\skills\<name>` |

Editing either path edits the same file, and `list` reports it as drifted from
then on. That's the intended way to customise a skill: your version wins until
you ask for it to be overwritten.

<details>
<summary><b>How your selection persists</b></summary>

The choice persists in `.vskills-config.json` under a `selection` key and is
honoured by later `init` and `update` runs without re-prompting. A plain
`update` refreshes only the selection (through its dependency closure) and
retires what dropped out, while `update <name>` stays an explicit, unfiltered
refresh of that name. An explicit flag overrides and rewrites the selection,
and explicit `--recommended` opts back into exactly the tier, dropping anything
else. An install made before selection existed keeps everything already on
disk plus the recommended tier.

The stored value is the `recommended` sentinel, not a frozen list: if the tier
changes, a skill that drops out retires into `.vskills-backup/` on the next run
instead of lingering. `list` marks each row's tier, and `add <skill>` installs
any skill regardless of tier. Discovery only looks at skill directories in the
repo itself and skips `CONTEXT/`, so worktree copies never collide with the
real skills.

</details>

<details>
<summary><b>Windows notes</b></summary>

The commands are the same in PowerShell, but `<` and `>` are reserved, so
replace `<skill>` with a real name.

On Windows, vskills asks for a directory junction, which needs
neither Developer Mode nor an elevated shell, so a stock corporate laptop can
install without a privilege request.

Junctions do have one limit. They are NTFS reparse points and cannot point at a
network location, so a `%USERPROFILE%` redirected to a UNC path or living on a
non-NTFS volume will fail. vskills then retries as a real directory symlink,
which supports remote targets but needs Developer Mode or an elevated shell. If
both fail, the skill still installs into the install root and the run reports
which targets were left unlinked. Re-run `init` once the condition is fixed.

</details>

<details>
<summary><b>npm blocks the install</b></summary>

If npm 12 blocks a GitHub spec with `EALLOWGIT` or `EALLOWREMOTE`, use
`npx --allow-git=all github:vraj-ai/skills init`, or clone the repo and run
`node bin/vskills.js init` with no npm involved.

</details>

### Keeping it current

- `npx @vskills/cli list` shows what is installed and what has drifted.
- `npx @vskills/cli update` refreshes everything and skips anything you edited.
- `npx @vskills/cli update <skill> --force` overwrites an edited skill, backing
  up the old copy first.
- `/plugin` lists installed Claude Code plugins and updates them.

## Contributing

Prove a change before calling it done. This is what the project-local
`.cursor/skills/verify-skills` runs, and a model verdict is not a pass:

```bash
node scripts/validate-skills.mjs && npm test
```

```
bin/              the vskills CLI entrypoint
src/              vskills implementation
test/             vskills test suite (node --test)
evals/            structural, routing, and behavioral skill evals

delivery/         ship, land
standalone/       route, grill, issues, investigate, debug, snapshot,
                  resume, push-handoff, setup-obsidian, setup-vskills,
                  pr-review, ponytail, test-tps
pipeline/         audit, delivery-constraints, implementation-tdd,
                  subagent-delegation, ai-subscription-unit-economics
principles/       principle-real-artifact, principle-evidence-over-report,
                  principle-bounded-repair, principle-named-constraints,
                  principle-independent-verdict
third-party/      pinned Matt Pocock, Addy Osmani, frontend-design packs
harness/          per-client Role and profile templates (omp, opencode)
.cursor/skills/   project-local verify-skills (not installed by vskills)
```

## Credits

- [pstack](https://github.com/cursor/plugins/tree/main/pstack) by poteto (MIT):
  the inner loop. Exhaust the design space, prove safety by running code,
  expand-contract for wide blast radius, and settle caller usage before module
  shape. Not vendored: `ship` runs `poteto-mode` inside itself, `grill` can hand
  off to `interrogate`, and `snapshot` maps to `ketchup`.
- [mattpocock/skills](https://github.com/mattpocock/skills) by Matt Pocock:
  `/grill-with-docs`, `/to-spec`, `/handoff`, `/to-tickets`, and the shape of
  the workflow. `/grill`, `/issues`, and `/snapshot` are this repo's versions.
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) by Addy
  Osmani: vendored under `third-party/`.
- [ponytail](https://github.com/DietrichGebert/ponytail) by DietrichGebert (MIT,
  v4.9.0, commit `0a4dd63ad4541f4f655c4108a295916f3c1d8fda`): the vendored
  decision ladder and the `delete / stdlib / native / yagni / shrink` rubric.
- [OpenAI skills catalog](https://github.com/openai/skills) (reference commit
  `49f948faa9258a0c61caceaf225e179651397431`): reviewed as inspiration for the
  manual-only workflows. No external source text is a dependency of any kept
  skill; see [VENDORED.md](VENDORED.md).

<details>
<summary>The review rubric's lenses came from reading these anti-slop skills</summary>

- [stop-slop](https://skills.sh/hardikpandya/stop-slop) by @hvpandya
- [no-ai-slop](https://skills.sh/petergyang/no-ai-slop/no-ai-slop) by @petergyang
- [humanizer](https://skills.sh/blader/humanizer) by @blader
- [unslop](https://skills.sh/cursor/plugins/unslop) by @poteto, plus Cursor's `deslop` and `thermo-nuclear-code-quality-review`
- [slopbeth](https://skills.sh/ehmo/slopkit/slopbeth) by @synopsi
- [humanizer](https://skills.sh/Aboudjem/humanizer-skill/humanizer) by @AdamBoudj
- [deslop](https://skills.sh/stephenturner/skills/deslop) by @strnr
- [anti-slop](https://skills.sh/elithrar/dotfiles/anti-slop) by @elithrar, plus their `simplify`
- [humanize](https://skills.sh/aashaexo/soundshuman/humanize) by @aashatwt
- [anti-ai-slop-writing](https://skills.sh/jalaalrd/anti-ai-slop-writing/anti-ai-slop-writing) by @jalaal_tweets

</details>

## License

MIT, see [LICENSE](LICENSE).
