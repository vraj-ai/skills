---
name: pr-review
version: 1.0.0
description: GitHub Actions PR review bot with Greptile parity — confidence 0-5, risk gates, checks annotations, and fix loop. Install via setup-vskills.
---

# PR Review

Polished GitHub-Actions review bot. Copy the templates into any repo with `setup-vskills` or `node standalone/pr-review/scripts/copy.mjs`.

## What it installs

- `.github/workflows/pr-review.yml` — diff-aware review, status checks, collapsible summary (PR Summary, Confidence Score 0-5, Issue Table, Sequence Diagram, Comments Outside Diff)
- `.github/workflows/pr-fix.yml` — fix comment trigger, one commit per comment, max 3 loops then `needs-human`
- `.vskills/review.yml` — all toggles: when to review, file-change limit (100), filters, strictness Low/Med/High, comment header, status checks (requiredConfidence 0-5), auto-approve (maximumRisk Low/Med/High/Critical)

## Triggers

- `pull_request: [opened, synchronize, reopened, ready_for_review]` + `workflow_dispatch` and tag review or `@vskills`
- `issue_comment: created` with `contains(body,'/fix')` on a PR, same-repo only (no forks)

## BYOK model

OpenAI-compatible `api-base` + `api-key`. Set `OPENAI_API_KEY` (or custom `secretName`) as repo/org secret and `vars.REVIEW_MODEL` if using compat. Without a key the workflow still posts deterministic checks (conflicts, gitleaks/osv/semgrep where present, lint/test if present) with a "limited review" notice.

## CONTEXT-aware

If the consumer repo has `CONTEXT/glossary.md` or `architecture.md`, the review job injects them (8k token cap) before chunking hunks (80 lines) and running ripgrep context.

## Verification

```
node --test 'test/pr-review-*.test.js'
```

Templates carry `<!-- vskills-pr-review -->` for idempotent upserts.
