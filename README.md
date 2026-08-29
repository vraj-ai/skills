# skills

Agent skills for running software work as a pipeline instead of a conversation,
plus `vskills`, a zero-dependency installer that puts them on your machine.

A skill is a file an agent loads on demand that says how to do one job properly.

```
npx @vskills/cli init
```

Same command on macOS, Linux, and Windows PowerShell.

## The workflow

| Step | What it does |
|---|---|
| `/setup-vskills` | First on a new machine. Asks which harness you use, researches it, installs Roles |
| `/grill` | Stress-tests the plan and writes glossary, architecture, and ADRs into `CONTEXT/` |
| `/issues` | Sets up the tracker once, then publishes a spec and tracer-bullet tickets |
| `/ship <spec>` | Builds it, reviews it, pushes it. Use `/goals` when you want more review |
| `/snapshot` | Syncs `CONTEXT/` and the tracker, writes a handoff, commits and pushes with remote SHA proof |

There is no separate review step. `/ship` and `/goals` review their own output at
three widths: the item gate, the milestone gate, and a read-only adversary over
the whole diff. `/grill`, `/issues`, and `/snapshot` are this repo's planning and
closeout skills. Matt Pocock's originals remain available, see
[Skills from elsewhere](#skills-from-elsewhere).

## Agents

The author runs this workflow in omp. The skills themselves stay harness-agnostic:
any client that can load a `SKILL.md` can run them, with any model.

`/setup-vskills` writes Invocation Roles (`grill`, `issues`, `ship`, `snapshot`,
`goals`) and Worker Roles (`researcher`, `builder`, `reviewer`, `adversary`,
`small-task`) into the harness it researched. On omp that is
`~/.omp/agent/agents/`. Role templates leave model and effort unset; assign those
in the harness. Reload the Agents tab with Ctrl+R. `/skill:grill` still works.

Workers never spawn. The Invocation Role is the only writer of backlog, locks,
and push.


## Two pipelines

Both drive a plan to verified, merged code using isolated worktrees, locked
verification commands, a resumable backlog, and a mandatory final adversary.
Only `/ship` and `/snapshot` push on their own.

| | `/ship` | `/goals` |
|---|---|---|
| Item review | 1 reviewer, only if the gate is already green | 2 independent reviewers |
| Milestone | Mechanical checks, then 1 rotating reviewer | Same, plus a stop for your go-ahead |
| Batch size | 4, capped at 8 | 3, capped at 4 |
| Stops | Only for trouble | After every milestone |
| Cost | Lower | Higher |

Reach for `/goals` when a defect is expensive to find late: auth, payments,
migrations. `/ship` is the right default everywhere else. Neither is worth it
for a throwaway script, a one-line fix, or exploratory work where you do not
know the question yet, and both need a test suite: without one the gate has
nothing to check.

## How it works

`/ship` and `/goals` each start one long-lived, resumable process. Whichever you
run is the only writer of its `backlog.jsonl` and the only thing that merges
branches.

*Maker is never checker.* The contributor builds in its own worktree and cannot
judge its own code. Reviewers are different models in a different context, and
they never see the author's rationale.

*Done is a command, not a claim.* Every item locks one verification command that
must exit 0, run after the final edit.

*Resume is state, not memory.* A fresh session reads the backlog, the handoff,
producer digests, and branch ancestry, never the chat history.

*One item, one branch, one worktree,* so parallel agents cannot overwrite each
other by construction. Green items merge even when a peer fails.

*The ladder.* Every contributor stops at the first rung that solves the problem:
necessity, codebase reuse, standard library, native platform, existing
dependencies, one-liner, minimal implementation. Input validation, error
handling, security, accessibility, and anything the acceptance criteria asked
for are never on the chopping block.

*The review rubric.* Every reviewer gets three lenses: `over-build`, `slop`, and
`structure`. A finding is admissible only when it names its replacement, a
stdlib function, an existing symbol in the repo, a native feature, or "delete,
nothing replaces it". Without one it is taste, and taste does not block a merge.

*Handoff is not delivery.* `push-handoff` is the explicit delivery step: it
verifies, commits, pushes, and proves the fetched remote SHA. `/ship` pushes
on a clean final gate. `/snapshot` pushes because you invoked it.

## The skills

**Delivery** (`delivery/`)

| Skill | Use when |
|---|---|
| `ship` | Spec to pushed code, gate-first review, owns its farm |
| `goals` | Wider-net plan driver with milestone stops, owns its farm |
| `council` | Independent research, debate, and scoped review |
| `council-adversary` | Read-only teardown of a converged diff |

**Standalone** (`standalone/`)

| Skill | Use when |
|---|---|
| `grill` | User-invoked interview; writes language and decisions into `CONTEXT/` |
| `issues` | User-invoked; one-time project setup, then spec plus tickets |
| `snapshot` | User-invoked closeout: sync docs and tracker, handoff, proven push |
| `push-handoff` | Commit and push under explicit authority, proven by remote SHA |
| `hands-free` | Finish the task without pausing, then wait for a push and PR merge |
| `loop-engineer` | Wrap any task in a maker/checker loop with a done-condition |
| `gauntlet-loop` | Blind maker/critic loop against a real quality bar |
| `multi-agent-review` | Several models attempt and cross-examine the same task |
| `herdr-orchestrator` | Run `/goals` through Codex and three council agents across live [Herdr](https://herdr.dev) panes |
| `setup-obsidian` | Turn a docs folder into a retrieval graph |
| `setup-vskills` | Set this repo up on a new machine |

`pipeline/` holds reusable disciplines you can pull in on their own:
`codebase-audit`, `invariant-evidence-review`, `provider-integration-tdd`,
`ticket-implementation-tdd`, worktree safety, subagent batching, pipeline
recovery, and more. `legacy-workflow/` holds the older chain.

Install one skill and its dependencies with `npx @vskills/cli add <skill>`.

## Skills from elsewhere

`/grill-with-docs`, `/to-spec`, and `/handoff` are Matt Pocock's, from
[mattpocock/skills](https://github.com/mattpocock/skills).

```bash
npx skills add mattpocock/skills                    # all of them
npx skills add mattpocock/skills/grill-with-docs    # or one at a time
npx skills add mattpocock/skills/to-spec
npx skills add mattpocock/skills/handoff
```

Run `npx skills add mattpocock/skills/setup-matt-pocock-skills` only if you still
want his originals. This repo's chain is `/grill` → `/issues` → `/ship` or `/goals` → `/snapshot`.

## Plugins

Plugins install through Claude Code's `/plugin` command, not `vskills`.

[ponytail](https://github.com/DietrichGebert/ponytail) is the one to start with.
It forces the laziest solution that works and ships `/ponytail`,
`/ponytail-review`, and `/ponytail-audit`. The build ladder is adapted from it.
From the [official marketplace](https://github.com/anthropics/claude-plugins-official):
`superpowers` for brainstorming, TDD, systematic debugging, and worktrees;
`skill-creator` for writing skills; `frontend-design` for UI work.

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
```

## Installing with `vskills`

```bash
npx @vskills/cli init               # install every skill
npx @vskills/cli list               # what is installed, what has drifted
npx @vskills/cli add <skill>        # one skill plus its dependencies
npx @vskills/cli update [skill...]  # refresh, skipping your local edits
```

On Windows PowerShell the commands are the same, but `<` and `>` are reserved,
so replace `<skill>` with a real name. Content is copied to an install root and
linked into each agent's skills directory:

| | install root | Claude Code target |
|---|---|---|
| macOS / Linux | `~/.agents/skills/<name>` | `~/.claude/skills/<name>` |
| Windows | `%USERPROFILE%\.agents\skills\<name>` | `%USERPROFILE%\.claude\skills\<name>` |

On Windows, vskills asks for a directory junction, which needs
neither Developer Mode nor an elevated shell, so a stock corporate
laptop can install without a privilege request.

Junctions do have one limit. They are NTFS reparse points and cannot point at a
network location, so a `%USERPROFILE%` redirected to a UNC path or living on a
non-NTFS volume will fail. vskills then retries as a real directory symlink,
which supports remote targets but needs Developer Mode or an elevated shell. If
both fail, the skill still installs into the install root and the run reports
which targets were left unlinked. Re-run `init` once the condition is fixed.

Your edits are safe by default: a skill whose content hash no longer matches the
manifest is marked `drifted` and left alone. Only `--force` overwrites it, and
it backs the old copy up to `~/.agents/skills/.vskills-backup/` first. Copies
stage in a temp dir and swap in with `rename`, so an interrupted install cannot
leave half a skill behind. Zero runtime dependencies, Node 18 or newer. Every
guarantee here is pinned by a test in [`test/`](test/), which ships in the
package.

If npm 12 blocks a GitHub spec with `EALLOWGIT` or `EALLOWREMOTE`, use
`npx --allow-git=all github:vraj-ai/skills init`, or clone the repo and run
`node bin/vskills.js init` with no npm involved.

## Keeping it current

- `npx @vskills/cli list` shows what is installed and what has drifted.
- `npx @vskills/cli update` refreshes everything and skips anything you edited.
- `npx @vskills/cli update <skill> --force` overwrites an edited skill. The old
  copy is backed up first.
- `npx skills add mattpocock/skills` again pulls newer versions of those.
- `/plugin` lists installed plugins and updates them.

Skills live in `~/.agents/skills/` and are symlinked into `~/.claude/skills/`.
Editing either path edits the same file, and `list` reports it as drifted from
then on. That is the intended way to customise one: your version wins until you
ask for it to be overwritten.

## Layout

```
bin/              the vskills CLI entrypoint
src/              vskills implementation
test/             vskills test suite (node --test)

delivery/         ship, goals, council, council-adversary
standalone/       grill, issues, snapshot, push-handoff, hands-free, loop-engineer,
                  gauntlet-loop, multi-agent-review, herdr-orchestrator,
                  setup-obsidian, setup-vskills
pipeline/         reusable delivery disciplines
legacy-workflow/  the preserved planner/coder/debugger/reviewer chain
harness/          per-client Role and profile templates (omp, opencode, ...)
```

`/setup-vskills` copies `harness/<name>/` after it researches the named harness.
OpenCode profiles live under `harness/opencode/` and install to
`~/.config/opencode/`. omp Role templates live under `harness/omp/agent/`.

## Credits

- [ponytail](https://github.com/DietrichGebert/ponytail) by DietrichGebert (MIT): the decision ladder, and the `delete / stdlib / native / yagni / shrink` shape of the rubric.
- [mattpocock/skills](https://github.com/mattpocock/skills) by Matt Pocock: `/grill-with-docs`, `/to-spec`, `/handoff`, `/to-tickets`, and the shape of the workflow. `/grill`, `/issues`, and `/snapshot` are this repo's versions, writing `CONTEXT/` and combining setup, spec, tickets, and closeout.
- [pstack](https://github.com/backnotprop/pstack) by poteto (MIT): exhaust the design space, prove safety by running code, expand-contract for wide blast radius, and settle caller usage before module shape.

The review rubric's three lenses came from reading these anti-slop skills:

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

MIT, see [LICENSE](LICENSE).
