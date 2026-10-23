---
name: setup-vskills
version: 2.0.0
description: Set up or update vskills on this machine and in a project. Installs and updates the vskills catalogue plus the pstack, Addy Osmani, and Matt Pocock skill packs, wires the harness, runs setup-pstack, then sets the project up with a first design, a verification skill, and an AGENTS.md, explaining each step to the user as it goes. Re-running it is the update.
recommended: true
---

# Setup vskills

Set up a machine and a project, and keep both current. Re-running this skill is the update path.

Tell the user what is happening as you go. Before each step, say in a sentence or two what it does and why it matters for their project. After it, say what changed and where. Ask before any step that writes into the project or the harness config. Every project-shaping step is at the user's discretion: offer it, recommend, and respect a no.

## 1. Install and update the skills

**vskills catalogue.**

```bash
npx @vskills/cli init      # first install
npx @vskills/cli update    # later runs; skips anything the user edited
```

From a clone of this repo, `node bin/vskills.js init` does the same with no npm. Init classifies each skill as install, up-to-date, adopt, update, or conflict, and backs up anything it overwrites to `<install-root>/.vskills-backup/`.

**Skill packs.** pstack, Addy Osmani's agent-skills, and Matt Pocock's skills, from their upstream repos:

```bash
node <install-root>/setup-vskills/scripts/install-packs.mjs
```

It clones each pack into `~/.agents/packs/<pack>` (pulls on later runs) and links every skill into the install root and each agent target. Priority settles name collisions: the vskills catalogue, then pstack, then Addy Osmani, then Matt Pocock. The losing skill is skipped and reported, so pstack's `/teach` and `/tdd` stay pstack's. `VSKILLS_PACK_<ID>=<dir>` uses an existing checkout as it is and never pulls it.

Anything already at a pack skill's path (a hand-installed copy, a link elsewhere) is left alone and reported. Show the user that list. Rerun with `--force` only after they agree. It backs up a real directory before replacing it.

Confirm with `npx @vskills/cli list` and check that `recall`, `how`, `why`, `teach`, `architect`, `grill`, `issues`, `ship`, `land`, `snapshot`, `resume-work`, `poteto-mode`, `create-verification-skill`, and `maintain-verification-skill` resolve in the install root.

In Claude Code, pstack skills use Cursor names. Point the user at `~/.agents/packs/pstack/pstack/docs/harness/claude-code.md`, which maps them (`Task` to `Agent`, model slugs, rules paths). The official alternative is the plugin (`/plugin marketplace add cursor/plugins`, then `/plugin install pstack@cursor-plugins`), which prefixes every command as `/pstack:<name>`. Use one or the other, not both.

Tell the user to restart the harness. Skills load once per session.

## 2. Wire the harness

Ask which harness is in use and research its agent and command model. There is no allowlist that skips research.

```bash
node <install-root>/setup-vskills/scripts/install-harness.mjs <harness>            # plan only, writes nothing
node <install-root>/setup-vskills/scripts/install-harness.mjs <harness> --install  # after the user says yes
```

| harness | template source | destination (override) |
| --- | --- | --- |
| `omp` | `harness/omp/agent/` | `~/.omp/agent/agents/` (`$OMP_AGENTS_DIR`) |
| `opencode` | `harness/opencode/` | `~/.config/opencode/` (`$OPENCODE_CONFIG_DIR`) |
| anything else | none | research it, then map `grill`, `issues`, `ship`, and `snapshot` onto its roles and commands |

A harness with no bundled installer is never an error. A listed harness that is not installed is skipped and reported, not created. Installs are atomic and idempotent, and back up differing files to `.vskills-backup/`.

## 3. Route models with /setup-pstack

Run `/setup-pstack`. It detects the models this session can use and writes one always-applied rule with a model per pstack role. Put the rule where the harness loads it every session:

- Cursor: `~/.cursor/rules/pstack-models.mdc`.
- Claude Code: `~/.claude/rules/pstack-models.md`, per pstack's Claude Code adapter.
- Anything else: the harness's always-applied rules location, or `docs/agents/model-routing.md` in the project with a pointer from AGENTS.md.

Never write a model the session cannot use, and never put a secret in the rule. Re-run it whenever entitlements change.

## 4. Set up the project

Run from the project root. Skip this step when the user is only setting up the machine. If the project is this vskills repo, follow [references/vskills-repo.md](references/vskills-repo.md) instead.

**Scaffold.** `node <install-root>/setup-vskills/scripts/init-context.mjs` creates `AGENTS.md` and `CONTEXT/architecture.md` when missing. It never overwrites either one.

**First design.** Offer it, and say it takes a while.

- Existing code: run `/how` over the main subsystems and a narrow `/why` (git and the tracker), then `/teach` the user how the project is built and why. Skip this for an empty repo.
- Ask what they want to build first. `/grill` the product intent, then `/architect` the first design when there is a design to make. Follow `/poteto-mode`'s principles throughout.
- Draft `CONTEXT/architecture.md`: purpose, locked decisions, invariants, non-goals, boundaries. Show the draft and write it only on a yes. The first build is then `/ship`.

**Verification skill.** Look for a project-local `verify-*` skill, or a harness that drives the app the way a user does. If one exists, note its command. If not, offer `/create-verification-skill` and run it on yes. `/ship` drives it to prove every user-facing change, and `/maintain-verification-skill` keeps its feature map honest.

**AGENTS.md.** Draft a real router from what you learned, not a template. Include:

- Build, test, and lint commands, taken from the repo.
- The verification skill and how to run it. After a user-facing change, `/ship` runs `/maintain-verification-skill`. Run it directly when the feature map has drifted.
- The tracker and its pointer file.
- The workflow. `/ship` takes any task to merged. `/land` merges only with explicit authority. `/snapshot` before a stop. `/resume-work` to continue.
- Where decisions live (`CONTEXT/architecture.md`).

Keep human-written content. Show the diff and write it only on a yes.

**PR review bot.** Optional. Offer `node <install-root>/pr-review/scripts/copy.mjs [project-root]` and default to no. On yes, ask for the model wiring (provider, auth, base URL, model, secret name) and write it to `.vskills/review.yml`, never the secret itself. Templates live in the `pr-review` skill.

## Reply

What was installed and updated (counts per source), collisions skipped, anything left untouched, each file written and where, and the follow-ups the user declined or that remain.

## Rules

- Never edit installed copies. Edit the source and re-run the installer.
- Change harness roles in `harness/<harness>/`, then reinstall with the user's approval.
- Bump a skill's `version:` whenever its content changes. Init uses it to resolve updates.
- Model routing and secrets live in separate files.
