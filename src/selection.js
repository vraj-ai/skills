export class UnknownSkillsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnknownSkillsError';
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
  let result;
  if (selection?.only) {
    const known = new Set(skills.keys());
    const unknown = selection.only.filter((n) => !known.has(n));
    if (unknown.length > 0) {
      throw new UnknownSkillsError(`unknown skill(s) passed to --only: ${unknown.join(', ')}`);
    }
    result = { names: new Set(selection.only), toPersist: [...selection.only] };
  } else if (selection?.all) {
    result = { names: new Set(skills.keys()), toPersist: 'all' };
  } else if (selection?.recommended) {
    const names = recommendedNames(skills);
    result = { names: new Set(names), toPersist: names };
  } else if (stored === 'all') {
    result = { names: new Set(skills.keys()), toPersist: null };
  } else if (Array.isArray(stored)) {
    result = { names: new Set(stored), toPersist: null };
  } else {
    // Nothing stored: a non-empty manifest predates selection support — seed
    // it from what's already installed (unioned with the recommended tier) so
    // upgrading doesn't silently retire everything else already on disk. A
    // fresh machine (empty manifest) just gets the recommended tier.
    const names = new Set([...installedNames, ...recommendedNames(skills)]);
    result = { names, toPersist: [...names] };
  }

  // Single exit for every branch above: whatever route got here, an empty
  // result would hand runInit an empty keep-set and retire every installed
  // skill. A genuinely empty repo is the only legitimate empty selection.
  if (result.names.size === 0 && skills.size > 0) {
    throw new UnknownSkillsError('the resolved selection is empty; this would retire every installed skill');
  }
  return result;
}
