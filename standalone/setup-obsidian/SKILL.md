---
name: setup-obsidian
version: 1.1.0
description: Turn a repo's docs folder into a retrieval graph — router, generated indexes, state file — and open it as an Obsidian vault.
disable-model-invocation: true
---

# setup-obsidian — build the retrieval graph

A docs folder with no map is a **pile**: every question reads every file. The same folder with a router and an index is a **librarian**: two or three files read, answer back.

The pretty graph view is a poster. The index is the engine. Build the engine.

Four artifacts, each with one job:

| File | Job |
|---|---|
| `ROUTER.md` | Signpost. Which index holds this kind of answer. Never the answer itself. |
| `index*.md` | Catalogue. One line per node: link, title, one sentence. **Generated.** |
| `state.md` | What survives between sessions. |
| the nodes | The knowledge. Already written — you are not authoring these. |

## Step 1 — Refuse an empty vault

Confirm the repo already holds real written knowledge — decision records, specs, planning docs, issues. Count them.

Structure over an empty folder is busywork. If there is nothing to index, stop and say so.

**Done when:** you can state the file count and where it lives.

## Step 2 — Pick the vault scope

The vault is the folder where **you can say why every file exists**. Usually the repo's docs directory, not the repo root — a root vault indexes `node_modules` and drowns the signal.

Two checks before committing to the scope:

- **Junk ratio.** Count indexable files inside the candidate versus the whole repo. If the candidate is not ~100% signal, tighten it or plan exclusions.
- **Link collisions.** Generated links are relative to the vault root. If a folder name inside the vault also exists at repo root (`docs/`, `plans/`), a root-scoped vault resolves links to the wrong one. Scoping to the docs directory dissolves this.

**Done when:** one folder is named, and you have stated the junk ratio and the collision check that chose it.

## Step 3 — Install the generator

A hand-written index **drifts**, and a drifted index is a pile again. So it is generated, never typed.

Copy [`build-graph-index.mjs`](build-graph-index.mjs) into the repo's scripts directory and adapt its `GROUPS` to the real subfolders. Wire a task in the project's runner (`npm run graph:index`, a Makefile target, whatever the repo already uses).

Split the index by **branch of question**, not into one big file: a question about decisions should never load the issue list. One index per category that a reader consults independently.

Then split again by **live versus settled**. Work items accumulate: a folder that is 90% shipped tickets produces an index where 90% of every load is history. Measured on a real vault, a 176-item issue index cost 11.3k tokens — more than grepping the folder it indexed, so the graph *lost* on issue questions. Filtering shipped/cut into a second file dropped the loaded index to 0.9k. Keep the settled index — it is still the way to answer "did we ever do X" — just stop paying for it on every other question. Treat a node with no status as live, so nothing silently disappears.

Extract per node: title from the first heading, status if the format carries one, and the first real sentence of prose. Status matters most — an index line reading `[superseded by 0023]` stops the agent opening a reversed decision without opening anything.

**Done when:** the generator runs, is idempotent (a second run writes nothing), and `--check` exits non-zero on drift.

## Step 4 — Verify every link resolves

Parse every generated `[[link]]` and assert the target file exists.

**Done when:** you report the count checked and the count broken. Broken must be zero.

## Step 5 — Write the router

Under 500 tokens. Measure it; do not estimate by eye.

It holds: one line on what the project is, the retrieval order (read index → score from index lines alone → open the single best → read only the answering section → follow at most one link), a table mapping *kind of question* → *which index*, and the rules that beat everything else (binding vocabulary, binding decisions, dependency order).

Anything explaining a concept belongs in a node. The moment the router teaches instead of points, it has become a manual that every session drags into context.

**Done when:** the measured token count is under 500.

## Step 6 — Add the state file

Session memory: what is being worked on, what was tried, dead ends not to retry, open questions. Read at session start, written at session end.

State it is scratch: when a fact becomes durable it moves into a real node and leaves state.

**Done when:** `state.md` exists with an open question naming the unproven claim from Step 8.

## Step 7 — Wire it into the repo

Two edits, both required or the graph is decoration:

- **Point the agent rules at the router.** In `AGENTS.md` / `CLAUDE.md`, make `ROUTER.md` the first thing read.
- **Guard the generated files.** Record that indexes are generated, never hand-edited, and regenerate after any file is added or renamed.

If a rule in those files forbids what you just did (many repos ban root-level files in the docs directory), **amend the rule explicitly and name the exception**. Silently breaking a stated rule is worse than the mess it prevents.

Gitignore the editor's per-machine UI state (`workspace.json`, `graph.json`); keep shared config committed.

**Done when:** an agent reading the repo's rules from scratch reaches the router first.

## Step 8 — Prove it, then open the vault

The skipped step, and the one that turns "feels faster" into a table. Run the same three questions against the raw folder and against the graph. Compare tokens read, files opened, and whether the answer was right.

Record the numbers in `state.md`. A graph you did not measure is a graph you are trusting on faith.

Then: open the editor, **Open folder as vault**, select the Step 2 folder, open `ROUTER.md`.

**Done when:** the comparison table exists and the vault opens on the router.

## Failure modes

| Smell | Cause | Fix |
|---|---|---|
| Answers still slow | Router grew into a manual | Cut it back to pointers |
| Agent opens the wrong file | Index lines describe vaguely | Regenerate with sharper summaries and status tags |
| Index missing new notes | Drift | `--check` in CI |
| Graph view is a hairball | Vault scoped too wide | Rescope to the signal folder |
| Agent cites a reversed decision | Status not surfaced in the index line | Extract status into the generated line |
| Index costs more than the folder it indexes | Settled work never leaves the index | Split live from shipped/cut; measure both |
