// Pure decision logic for the interactive `vskills init` picker, split out
// of bin/vskills.js so it's unit-testable without driving readline/stdin
// (bin's repoRoot/installRoot are module-level consts and not injectable).

// Splits a comma- and/or whitespace-separated list of skill names.
export function parseNameList(raw) {
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

// Plain Enter (empty string) must defer to resolveSelection's own no-flag
// default (null), never force the recommended tier — forcing it here is
// what made the migration branch (installed ∪ recommended) unreachable on
// any TTY, silently retiring an existing install down to just the tier.
export function interpretSelectionAnswer(answer) {
  const lower = answer.trim().toLowerCase();
  if (lower === '') return null;
  if (lower === 'a' || lower === 'all') return { all: true };
  if (lower === 'p' || lower === 'pick') return { pick: true };
  return { only: parseNameList(answer) };
}
