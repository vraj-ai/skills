export class UnknownSkillsError extends Error {
  constructor(names) {
    super(`unknown skill(s) passed to --only: ${names.join(', ')}`);
    this.name = 'UnknownSkillsError';
    this.names = names;
  }
}

function recommendedNames(skills) {
  return [...skills.values()].filter((s) => s.recommended).map((s) => s.name);
}

// `selection` is the explicit, already-parsed flag intent:
//   { all: true } | { recommended: true } | { only: string[] } | null
// `stored` is whatever is currently in .vskills-config.json: an array, the
// sentinel string 'all' (so a later-added skill is still covered by "all"
// instead of being frozen out of a stale name snapshot), or null.
// `installedNames` is Object.keys(manifest.skills) — used only to migrate a
// pre-selection install (see below).
// Returns { names: Set<string>, toPersist: string[] | 'all' | null } —
// `toPersist` is non-null only when the resolved selection should be
// (re)written to config: an explicit flag always rewrites; falling back to
// a derived default because nothing is stored yet also seeds config so the
// next no-flag run doesn't re-derive it.
export function resolveSelection({ skills, selection, stored, installedNames = [] }) {
  if (selection?.only) {
    const known = new Set(skills.keys());
    const unknown = selection.only.filter((n) => !known.has(n));
    if (unknown.length > 0) throw new UnknownSkillsError(unknown);
    return { names: new Set(selection.only), toPersist: [...selection.only] };
  }

  if (selection?.all) {
    return { names: new Set(skills.keys()), toPersist: 'all' };
  }

  if (selection?.recommended) {
    const names = recommendedNames(skills);
    return { names: new Set(names), toPersist: names };
  }

  if (stored === 'all') {
    return { names: new Set(skills.keys()), toPersist: null };
  }

  if (Array.isArray(stored)) {
    return { names: new Set(stored), toPersist: null };
  }

  // Nothing stored: a non-empty manifest predates selection support — seed
  // it from what's already installed (unioned with the recommended tier) so
  // upgrading doesn't silently retire everything else already on disk. A
  // fresh machine (empty manifest) just gets the recommended tier.
  const names = new Set([...installedNames, ...recommendedNames(skills)]);
  return { names, toPersist: [...names] };
}
