---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS - not the current workspace.

Use this compact shape so a fresh agent can scan it without rereading the
conversation:

```markdown
# Session Handoff — <focus>
## Objective
## Important Details
## Work State
## Next Move
## Relevant Files
## Suggested Skills
```

Include a "Suggested Skills" section with skills the next agent should invoke.
Keep the handoff evidence-led: point at existing plans, issues, commits, diffs,
tests, or review records instead of copying their contents.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
