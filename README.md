# skills

Agent skills for running software work as a pipeline instead of a conversation,
plus `vskills`, a zero-dependency installer that puts them on your machine.

A skill is a file an agent loads on demand that says how to do one job properly.

```
npx @vskills/cli init
```

Same command on macOS, Linux, and Windows PowerShell.

## The workflow

Start with an outcome or a referenced issue. Use only the stages the task needs.

| Skill | Use it for |
|---|---|
| `/grill` | Consequential product/design choices when intent is unclear |
| `/issues` | A durable work queue with acceptance, references, and verification |
| `/ship #123` | Find or execute work, verify behavior, obtain review, and deliver under repo policy |
| `/snapshot` | A short resume note for unfinished work |

A clear task goes straight to `/ship`. Snapshot is optional and does not grant
push authority. Issues/PRs hold intent and shared status; source/checks establish
behavior; small decision docs preserve rationale. Inside T3, ship uses native
child tasks, PR links/watches, and browser evidence.

## Agents

The author runs this workflow in omp. The skills themselves stay harness-agnostic:
any client that can load a `SKILL.md` can run them, with any model.

`/setup-vskills` writes Invocation Roles (`grill`, `issues`, `ship`, `snapshot`) and Worker Roles (`researcher`, `builder`, `reviewer`, `adversary`,
`small-task`) into the harness it researched. On omp that is
`~/.omp/agent/agents/`. Role templates leave model and effort unset; assign those
in the harness. Reload the Agents tab with Ctrl+R. `/skill:grill` still works.

Workers never spawn. The Invocation Role is the only writer of backlog, locks,
and push.

*Handoff is not delivery.* `push-handoff` is the explicit delivery step: it
verifies, commits, pushes, and proves the fetched remote SHA when delivery is
authorized. Snapshot only checkpoints; it does not grant push authority.

## The skills

**Delivery** (`delivery/`)

| Skill | Use when |
|---|---|
| `ship` | Thin task navigator and verified delivery |

**Standalone** (`standalone/`)

| Skill | Use when |
|---|---|
| `grill` | Clarify consequential intent and preserve missing durable decisions |
| `issues` | Publish proportionate tracker work with acceptance and verification |
| `snapshot` | Optional short checkpoint for unfinished work |
| `push-handoff` | Commit and push under explicit authority, proven by remote SHA |
| `setup-obsidian` | Turn a docs folder into a retrieval graph |
| `setup-vskills` | Set this repo up on a new machine |
| `pr-review` | GitHub Actions PR review bot: summary, confidence, checks, fix-on-comment |
| `test-tps` | Benchmark selected Pi model: TTFT, decode/average TPS, usage, cost, percentiles |

The decision ladder is vendored as `ponytail` (MIT, DietrichGebert, pinned to
v4.9.0; see VENDORED.md for provenance).
`pipeline/` holds reusable disciplines you can pull in on their own: `audit`,
`delivery-constraints`, `implementation-tdd`, `subagent-delegation`, and
`ai-subscription-unit-economics`.

Install one skill and its dependencies with `npx @vskills/cli add <skill>`.

## Skills from elsewhere

Pinned copies live under `third-party/`. They are not part of the vskills
catalogue: `vskills init` and `vskills add` do not install them. Provenance
and commits are in VENDORED.md.

| Pack | Path | Source |
|---|---|---|
| Matt Pocock | `third-party/mattpocock/skills` | [mattpocock/skills](https://github.com/mattpocock/skills) |
| Addy Osmani | `third-party/addyosmani/skills` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) |
| Frontend design | `third-party/frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) `frontend-design` |

This repo's own loop stays grill, issues, ship, and snapshot.

## Plugins

Plugins install through Claude Code's `/plugin` command, not `vskills`.

[ponytail](https://github.com/DietrichGebert/ponytail) is vendored here as the
single `ponytail` skill (see VENDORED.md), so `vskills` installs it without a
duplicate local name. The optional Claude plugin remains useful for hosts that support
marketplace plugins. It forces the laziest solution that works; the build
ladder is adapted from it. From the
[official marketplace](https://github.com/anthropics/claude-plugins-official):
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
npx @vskills/cli init                    # install the recommended set (default)
npx @vskills/cli init --recommended      # exactly the recommended set, dropping anything else
npx @vskills/cli init --all              # install every skill
npx @vskills/cli init --only ship,grill  # install exactly these skills
npx @vskills/cli list                    # what is installed, what has drifted
npx @vskills/cli add <skill>             # one skill plus its dependencies
npx @vskills/cli update [skill...]       # refresh, skipping your local edits
```

`init` leads with the recommended set — `ship`, `grill`, `issues`,
`snapshot`, `setup-vskills`, and `ponytail` —
and nothing more is needed for the workflow above. `snapshot` pulls in its
`push-handoff` dependency, so a fresh machine lands seven skills. On a TTY,
`init` shows that set and offers to accept it (plain Enter), install
everything, or pick names; `--yes` and non-TTY runs take the recommended set
without asking. `list` marks each row's tier, and `add <skill>` still installs
any skill regardless of tier.

The choice persists in `.vskills-config.json` under a `selection` key and is
honoured by later `init` and `update` runs without re-prompting — a plain
`update` refreshes only the selection (through its dependency closure) and
retires what dropped out, while `update <name>` stays an explicit, unfiltered
refresh of that name; an explicit flag overrides and rewrites it, and explicit
`--recommended` opts back into exactly the tier, dropping anything else. An
install made before selection existed keeps everything already on disk plus the
recommended tier. The stored value is the
`recommended` sentinel, not a frozen list: if the tier ever changes, a skill
that drops out retires into `.vskills-backup/` on the next run instead of
lingering. Discovery only looks at skill directories in the repo itself and
skips `CONTEXT/`, so worktree copies never collide with the real skills.

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

delivery/         ship
standalone/       grill, issues, snapshot, push-handoff,
                  setup-obsidian, setup-vskills, pr-review, ponytail
pipeline/         audit, delivery-constraints, implementation-tdd,
                  subagent-delegation, ai-subscription-unit-economics
harness/          per-client Role and profile templates (omp, opencode, ...)
```

`/setup-vskills` copies `harness/<name>/` after it researches the named harness.
OpenCode profiles live under `harness/opencode/` and install to
`~/.config/opencode/`. omp Role templates live under `harness/omp/agent/`.

## Credits

- [ponytail](https://github.com/DietrichGebert/ponytail) by DietrichGebert (MIT,
  v4.9.0, commit
  `0a4dd63ad4541f4f655c4108a295916f3c1d8fda`): the vendored decision ladder
  and the `delete / stdlib / native / yagni / shrink` rubric.
- [OpenAI skills catalog](https://github.com/openai/skills) (reference commit
  `49f948faa9258a0c61caceaf225e179651397431`): reviewed as inspiration while
  authoring local manual-only workflows. No external source text is a
  dependency of any kept skill; see VENDORED.md for provenance.
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
