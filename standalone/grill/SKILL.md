---
name: grill
version: 2.2.1
description: Clarify an ambiguous feature or design through direct questions before work is queued. Resolve consequential decisions and preserve only durable intent.
argument-hint: "[topic]"
recommended: true
---

# Grill

Clarify the outcome, boundaries, and decisions needed to make work actionable. Do not build or publish tickets.

Read repo instructions and relevant code first. Consult relevant parts of CONTEXT/glossary.md, CONTEXT/architecture.md, and CONTEXT/adr/ when present. Follow CONTEXT-MAP.md in a multi-context repo.

Find observable facts yourself. Use a short experiment for an empirical fork when it fits the requested scope. Ask the user about product intent, preferences, or trade-offs an experiment cannot settle. Hand an architecture fork to pstack `/how` and `/architect`. A contested design can hand off to pstack `/interrogate`; this skill does not apply that verdict. When pstack is not installed, present distinct options and a recommendation instead.

Ask independent questions together; settle prerequisites before dependent questions. Stop when outcome, acceptance, constraints, and important unresolved risks are clear enough to proceed. An exhaustive implementation interview is unnecessary.

Record only information a fresh agent could otherwise get wrong. Update the relevant decision in CONTEXT/architecture.md; define a term in CONTEXT/glossary.md only when outsiders would misunderstand it. Create an ADR only for a hard-to-reverse, surprising decision with a real trade-off. Preserve unrelated prose and create files lazily.

Never write CONTEXT/progress.md, a pipeline backlog, or another owner's handoff. Code and checks establish behavior; issues hold task intent and shared status; decision docs preserve rationale.

Return the agreed outcome, acceptance, boundaries, and remaining decisions. Suggest /issues when queued work is wanted. A clear small task can go straight to /ship. Stage invocation does not authorize the next stage or an external write.
