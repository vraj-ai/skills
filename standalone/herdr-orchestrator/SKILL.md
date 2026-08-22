---
name: herdr-orchestrator
version: 1.0.0
description: "Interactive Herdr setup and orchestration for a Grok pane coordinating Codex and three non-OpenCode Council agents."
disable-model-invocation: true
argument-hint: "[optional goal or milestone]"
dependencies: [goals, council, parallel]
---

# Herdr Orchestrator

User-invoked, question-first skill. It explains the live Herdr setup, asks
which panes and models to use, creates the requested two-tab layout, then
orchestrates Council planning and Codex goal execution. It does not silently
choose agents or models.

## Done condition

Orientation/setup is complete only after:

- Herdr caller context is verified.
- Current workspace, tabs, panes, agents, cwd, and lifecycle states are read.
- User confirms the Main and Council Agents tab layout.
- User selects or confirms the model/integration for every new pane.
- Exactly three non-OpenCode Council targets are identified.
- Codex goal target and durable goal cursor are identified.
- Pause-on-milestone and user-continue behavior are confirmed.
- The first dispatch and verification command are written.

Missing facts become one targeted question. Never infer identity from sidebar
position, stale chat, or model labels.

## 1. Herdr boundary

Herdr owns workspaces, tabs, panes, PTYs, recognized agents, focus, lifecycle
state, and terminal persistence. Grok observes and dispatches through Herdr;
Grok does not invent a second terminal/session authority.

Run inside a Herdr-managed pane:

    test "$HERDR_ENV" = 1

If this fails, report that the caller is outside Herdr and stop. Do not inspect
or control another Herdr session from outside.

Read installed command authority:

    herdr --help
    herdr --skill

Never run bare herdr for discovery; it launches or attaches the TUI.

## 2. Ask setup questions

Ask one question at a time, skipping only facts proven by live Herdr output:

1. “Confirm this is the Grok orchestrator pane. What pane label, agent name,
   cwd, workspace ID, and tab ID should I use?”
2. “Which existing pane is Codex goal worker? What integration and model should
   Codex use?”
3. “Which three Council agents and models should occupy Council Agents? Exclude
   every OpenCode agent. May I create missing Council panes?”
4. “Should Main contain Grok, Codex, Prime Agent, and any existing user panes?
   Which panes must remain untouched?”
5. “What goal and milestone should resume? Where is durable handoff/backlog?”
6. “Pause after every milestone/T1 and wait for the exact user word continue?”
   Default: yes.

Default proposal, requiring confirmation:

- Main tab: Grok orchestrator, Codex goal worker, Prime Agent user-managed.
- Council Agents tab: exactly three Council agents selected by the user.
- Opus 5/Claude: untouched.
- OpenCode pane and OpenCode Council agent: unused.

## 3. Explain current Herdr

Topology:

    workspace -> tab -> pane -> terminal/PTY
                              \-> recognized agent (optional)

A pane can exist without an agent. Agent names are unique live targets and
follow the current pane occupant. Model labels are display metadata, not safe
targets.

Public IDs are opaque:

- workspace: w1
- tab: w1:t1
- pane: w1:p1

Read live state:

    herdr workspace list
    herdr tab list --workspace WORKSPACE_ID
    herdr pane current --current
    herdr pane list --workspace WORKSPACE_ID
    herdr agent list
    herdr agent get TARGET

Lifecycle:

- working: active work observed.
- idle: ready for input.
- done: settled idle after unseen background work.
- blocked: approval or question UI recognized.
- unknown: classification uncertain; never treat as complete.

Use agent commands for recognized agents:

    herdr agent read TARGET --source recent-unwrapped --lines 120
    herdr agent prompt TARGET "message" --wait --timeout 120000
    herdr agent wait TARGET --until blocked --timeout 120000

Use pane commands for raw terminals, ordinary commands, layout, and output.
Prefer recent-unwrapped for logs. CLI reads do not focus tabs. Use current
caller context, explicit IDs, or unique live agent names; parse IDs from JSON.

Agent start requires an existing shell pane:

    herdr agent start NAME --kind KIND --pane PANE_ID -- MODEL_ARGUMENTS

The installed agent command prints valid kinds and options. Pass native model
arguments only after the separator. Ask the user before starting a new model.

## 4. Build two tabs and panes

After answers, inspect existing topology. Reuse matching Main and Council
Agents tabs. Create only missing tabs, preserving cwd and user focus:

    herdr tab create --workspace WORKSPACE_ID --cwd CWD --label Main --no-focus
    herdr tab create --workspace WORKSPACE_ID --cwd CWD --label "Council Agents" --no-focus

Read returned tab and root-pane IDs from JSON. Split panes deliberately:

    herdr pane split --pane PANE_ID --direction right --cwd CWD --no-focus

Read every new pane ID from JSON. Start only the requested integration/model.
Give each live agent a unique name. Never replace an existing pane merely to
change its model; ask first.

Setup completion requires a fresh workspace/tab/pane/agent snapshot proving:

- Main exists.
- Council Agents exists.
- Codex target is reachable.
- Three Council targets are reachable and none is OpenCode.
- User-managed panes remain unchanged.

## 5. Skill delegation

Use these skills inside this orchestrator:

- $goals: durable goal state, locks, milestone cursor, handoff, continuation.
- $council: independent planning and review using exactly three allowed Council
  agents; exclude OpenCode.
- $parallel: only for independent, bounded worktree items approved by goals.
  Never parallelize one goal writer, shared files, pane setup, or Herdr control.

Do not infer goal progress from chat. Read the durable handoff/backlog first.

## 6. Orchestration loop

### Plan

Invoke $goals, then ask the three allowed Council agents the same bounded
question independently. Synthesize agreement, disagreement, risks, selected
plan, acceptance criteria, and verification command.

### Dispatch

Send one selected goal to the live Codex target:

    herdr agent prompt CODEX_TARGET "goal, acceptance criteria, verification command, evidence requirements" --wait --timeout 120000

Codex owns implementation, tests, commits, and goal evidence. Address its live
Herdr agent name. If its pane displays Luna, treat Luna as a display label and
use the live Codex target.

### Peek continuously

While Codex works, run an event loop:

1. Wait for lifecycle/output change.
2. Read Codex output with recent-unwrapped.
3. Read all three Council states when a decision or review is due.
4. Compare claims with durable goal state and repository evidence.
5. Recover routine stalls; notify the user for questions, approvals, failures,
   or genuine blockers.

Continuous peek means repeated wait/read/reconcile, not busy-spinning and not
trusting one old transcript.

### Milestone stop

When Codex reaches a milestone, T1 boundary, or required stop:

1. Send no next-work prompt.
2. Read final output, tests, diff/status, and goal evidence.
3. Update the durable cursor through $goals.
4. Notify the user with exact reached item and evidence.
5. Stop orchestration and wait.

Optional Herdr notification:

    herdr notification show "Ultron paused" --body "MILESTONE reached; waiting for continue" --sound request

On user message continue:

1. Re-read handoff, backlog, evidence, repository status, and Herdr state.
2. Ask the three allowed Council agents to review continuation context.
3. Invoke $goals continuation.
4. Tell the live Codex/Luna worker to resume from the recorded cursor.
5. Restart the peek -> reconcile -> milestone-stop loop.

Never bypass a pause because a pane looks idle. Never claim completion from a
chat sentence alone.

## 7. Safety

- Herdr remains sole terminal/workspace/session authority.
- Keep Prime Agent, Opus/Claude, OpenCode pane, and OpenCode Council target untouched.
- Use no-focus for background work unless user requests focus.
- Do not close panes, tabs, workspaces, or sessions not created by this run.
- Never run Herdr server stop from an active session.
- Prefer agent prompt over raw pane send-text.
- Preserve credentials and redact sensitive output.
- Commit or push only when goal authority and user scope allow it.

## 8. Output

After setup, output exactly:

    Herdr snapshot: caller, workspace, tabs, panes, agents, cwd, states
    Role map: Grok, Codex, Council-1/2/3, untouched panes
    Goal: cursor, handoff/backlog, latest evidence
    Orchestration: $goals -> $council -> Codex -> peek -> evidence -> pause
    Next dispatch: one concrete Codex message
    Waiting rule: exact user signal continue

If setup cannot complete, output missing fact plus one question only.
