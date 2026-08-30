---
name: pi-usage-maintenance
description: Run an explicitly requested maintenance pass over Pi usage data, indexes, reports, and retention checks.
version: 1.0.0
disable-model-invocation: true
argument-hint: "[date range or maintenance scope]"
source: local
source-commit: 2a1e1155497bcea1c561c6415e801ca1790e83e5
attribution: Vraj / vraj-ai
license: MIT
---

# Pi usage maintenance

This is a manual-only runbook for maintaining Pi usage reporting. Do not
invoke it from an ordinary coding prompt, and do not silently collect or
upload telemetry.

## Invariants

- Treat Pi's append-only JSONL/session records as the source of truth. SQLite,
  caches, charts, and summaries are rebuildable indexes, never the only copy.
- Preserve raw records and timestamps; normalize only in derived tables.
- Separate observed provider-reported usage from estimates. Label missing,
  sampled, or inferred values instead of filling them with guesses.
- Keep historical pages immutable while allowing a bounded live tail to update.
- Aggregate by default. Do not expose prompts, responses, paths, account
  identifiers, or secrets in reports unless the user explicitly requests a
  redacted sample.

## Procedure

1. Confirm the requested scope, Pi data root, timezone, retention policy, and
   whether this is a dry run. Resolve paths explicitly; never scan a home
   directory or delete by a broad glob.
2. Snapshot or checksum the input files before changing derived state. Record
   the highest source offset/timestamp processed so a rerun is idempotent.
3. Rebuild or incrementally sync the index from JSONL. Use stable event IDs;
   tolerate truncated final lines and report them for later repair.
4. Recompute daily and monthly aggregates, including request counts, tokens
   (input/output/cache when available), latency, errors, and provider/model
   dimensions. Keep unknown values as unknown.
5. Validate that totals reconcile with the raw event count and that no
   timestamp moves backwards. Check duplicate IDs, impossible negative values,
   stale live cursors, and estimate/report mixing.
6. Produce a short maintenance report: source range, rows read, rows added,
   rows skipped with reasons, index/checksum, aggregate changes, and any
   privacy or retention concern. Ask before deleting or exporting anything.

## Safety and recovery

Use a temporary rebuild plus atomic rename for derived files. Keep the prior
index until validation passes so rollback is a file move, not a reconstruction.
If a source file is malformed, quarantine only the specific record or suffix
and leave the original untouched. Stop on permission, path, or schema
ambiguity. Never commit, push, or modify Pi configuration as part of usage
maintenance unless separately authorized.

## Done when

The requested range is reproducible from preserved source data, observed and
estimated values are visibly distinguished, validation checks pass, and the
report names every skipped or changed record.
