---
name: github-workflow
description: Run a deliberate GitHub repository, issue, pull-request, review, CI, or publish workflow when the user explicitly invokes this skill.
version: 1.0.0
disable-model-invocation: true
argument-hint: "[repo, issue, PR, or workflow]"
attribution: Vraj / vraj-ai
license: MIT
source: local
source-commit: 2a1e1155497bcea1c561c6415e801ca1790e83e5
---

# GitHub workflow

Manual-only workflow authored by Vraj. It is complete and standalone: use the
active host's documented connector, API, or CLI, and never assume a particular
harness, model, extension, or sibling skill is installed.

## Authority and scope

- Treat repository, issue, pull request, review, and CI inspection as read-only
  unless the user explicitly authorizes a write.
- Commit, push, posting comments, changing labels, retrying CI, and creating or
  updating a pull request are external writes. Perform each only when the
  user's instruction clearly grants that action; do not infer it from “fix”,
  “review”, or “prepare”. Never merge or force-push without separate explicit
  authority.
- Resolve the exact repository, ref, item number, and target before acting. If
  any is ambiguous, ask instead of guessing. Never claim an action, check, or
  log that was not actually observed.

## Select a capability

1. Discover the active host's available connector, API, and CLI capabilities.
2. Prefer a structured connector or API for repository metadata, issues, pull
   requests, comments, reviews, labels, reactions, and check results.
3. Use local git for checkout status, branches, diffs, and commits. Use the
   host's documented GitHub CLI for gaps such as current-branch PR discovery,
   remote checks, and workflow logs.
4. If no capability can perform the requested operation, report the blocker and
   offer a safe read-only alternative. Do not invent commands or route to a
   missing skill.

## Orient a repository or pull request

1. Resolve the repository from the supplied URL/name, or from the current
   checkout only when the user refers to it. Verify the remote, current branch,
   working-tree state, and requested base/head.
2. Resolve a pull request from its URL/number or current branch. Confirm the
   repository and PR before reading or writing anything.
3. Gather the title and body, base/head refs and SHAs, author, labels, review
   decision, unresolved threads, changed files, mergeability, and check states.
4. Report a concise orientation with links or command evidence, scope, risks,
   and the next useful read-only step. Keep local uncommitted work separate
   from remote PR state.

## Review comments and requested changes

- Collect general reviews and inline threads, including unresolved status,
  file/line location, reviewer, and the concrete request. Distinguish an
  actionable defect from a question, suggestion, or already-resolved thread.
- Inspect the relevant commit and local files before proposing a change. Make
  the smallest safe edit, run the narrowest useful tests, and report the diff
  and evidence. Do not mark a thread resolved or post a reply without explicit
  authority to change remote review state; draft the response when authority is
  absent.
- Never paste credentials, private logs, or unverified claims into a comment.

## CI failures

1. Identify the failed check and the exact commit, then obtain its summary and
   logs through the available API or CLI. Say when logs are unavailable.
2. Separate a product/test failure from an infrastructure or flaky failure.
   Reproduce the relevant command locally when safe, without weakening tests or
   hiding failures.
3. If a code change is requested, edit locally, run focused tests, and report
   the result. Retrying a remote job, changing workflow configuration, or
   canceling a run is a remote write and requires explicit authority.

## Commit, push, and pull request

Proceed only after explicit authority covers the requested action:

1. Inspect status and the complete diff; run the requested or relevant tests.
2. Stage only intended paths, show the proposed commit message and scope, then
   commit. Record the resulting commit SHA.
3. Before pushing, verify the remote, destination branch, and non-force update.
   Push only that branch, report the remote SHA, and never force-push without a
   separate explicit instruction.
4. Before creating or updating a PR, confirm base/head, title, body, draft
   state, reviewers, and labels. Create or update it only with authority, then
   report its URL and observed checks. Do not merge automatically.

Without that authority, leave the checkout and remote unchanged and provide a
reviewable summary plus the exact next action the user may authorize.

## Completion report

State the repository and item scope, capabilities used, observations, files or
remote objects changed, test/check evidence, and any remaining blocker. A task
is complete only when the requested outcome is observed and the corresponding
write authority was present; otherwise it remains a report or draft.
