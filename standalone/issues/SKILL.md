---
name: issues
version: 2.0.0
description: Turn an agreed outcome into tracker issues with acceptance, dependencies, references, and verification. Keep planning proportional to the work.
disable-model-invocation: true
argument-hint: "[task-or-spec-reference]"
recommended: true
---

# Issues

Publish agreed work in the project's tracker. Do not build or restart a design interview.

Read AGENTS.md, docs/agents/issue-tracker.md, and docs/agents/triage-labels.md when present. Use their commands and conventions. Otherwise infer the tracker from the remote and available tools; ask only when the destination or intended scope is genuinely ambiguous. Add a short tracker pointer to AGENTS.md if needed. Do not scaffold empty context files or pipeline state.

Fetch a referenced spec or issue with its comments. Inspect relevant source and test configuration. Respect existing decision docs. Identify a specific missing product decision rather than inventing acceptance criteria.

One issue is enough for one coherent task. Split when dependencies, independent ownership, or separately verifiable delivery warrant it. Use a parent spec when it helps explain a multi-issue effort. File and code references are welcome when they save rediscovery.

Each issue contains:

- Outcome and expected behavior.
- Checkable acceptance and important boundaries.
- Relevant issue, design, source, and test references.
- Dependencies, or an explicit statement that it can start.
- A Verification-command derived from existing checks, plus runtime or manual acceptance when needed. A build pass must not masquerade as behavior verification.

Present a substantial breakdown once. Honor existing publishing authority and approval; do not ask again for already authorized work. Publish blockers first and use the repo's ready label, such as ready-for-agent, with all required label axes. Avoid a duplicate local backlog and an extra closeout comment repeating the published issues.

Return issue URLs and a concise starting instruction, such as /ship #123. Start the next stage only when requested.
