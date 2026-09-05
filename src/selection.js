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
// sentinel string 'all' or 'recommended' (so a later-added skill is still
// covered instead of being frozen out of a stale name snapshot), or null.
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
    // Persist the 'recommended' sentinel, not a frozen name snapshot — a
    // skill marked recommended after this user's init must still reach them,
    // exactly like '--all' persists 'all' instead of today's member list.
    result = { names: new Set(recommendedNames(skills)), toPersist: 'recommended' };
  } else if (stored === 'all') {
    result = { names: new Set(skills.keys()), toPersist: null };
  } else if (stored === 'recommended') {
    result = { names: new Set(recommendedNames(skills)), toPersist: null };
  } else if (Array.isArray(stored)) {
    result = { names: new Set(stored), toPersist: null };
  } else {
    // Nothing stored: a non-empty manifest predates selection support — seed
    // it from what's already installed (unioned with the recommended tier) so
    // upgrading doesn't silently retire everything else already on disk. A
    // fresh machine (empty manifest) just gets the recommended tier.
    // A fresh machine gets exactly the tier, so persist the sentinel and stay
    // subscribed to it; a migrated install is a genuine one-off set (whatever
    // happened to be on disk, unioned with the tier), so that one is a snapshot.
    const names = new Set([...installedNames, ...recommendedNames(skills)]);
    result = { names, toPersist: installedNames.length === 0 ? 'recommended' : [...names] };
  }

  // Single exit for every branch above: whatever route got here, an empty
  // result would hand runInit an empty keep-set and retire every installed
  // skill. A genuinely empty repo is the only legitimate empty selection.
  if (result.names.size === 0 && skills.size > 0) {
    throw new UnknownSkillsError('the resolved selection is empty; this would retire every installed skill');
  }
  return result;
}
