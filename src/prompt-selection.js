// Pure decision logic for the interactive `vskills init` picker, split out
// of bin/vskills.js so it's unit-testable without driving readline/stdin
// (bin's repoRoot/installRoot are module-level consts and not injectable).

// Splits a comma- and/or whitespace-separated list of skill names.
export function parseNameList(raw) {
  return raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}

// Plain Enter (empty string) must mean "accept the recommended set", never
// "install nothing".
export function interpretSelectionAnswer(answer) {
  const lower = answer.trim().toLowerCase();
  if (lower === '') return { recommended: true };
  if (lower === 'a' || lower === 'all') return { all: true };
  if (lower === 'p' || lower === 'pick') return { pick: true };
  const names = parseNameList(answer);
  return names.length > 0 ? { only: names } : { recommended: true };
}
