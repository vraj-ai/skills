// selection: iterable of skill names to install; omit for all discovered.

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
// `stored` is whatever array (or null) is currently in .vskills-config.json.
// Returns { names: Set<string>, toPersist: string[] | null } — `toPersist`
// is non-null only when the resolved selection should be (re)written to
// config: an explicit flag always rewrites; falling back to the recommended
// default because nothing is stored yet also seeds config so the next
// no-flag run doesn't re-derive it.
export function resolveSelection({ skills, selection, stored }) {
  if (selection?.only) {
    const known = new Set(skills.keys());
    const unknown = selection.only.filter((n) => !known.has(n));
    if (unknown.length > 0) throw new UnknownSkillsError(unknown);
    return { names: new Set(selection.only), toPersist: [...selection.only] };
  }

  if (selection?.all) {
    const names = [...skills.keys()];
    return { names: new Set(names), toPersist: names };
  }

  if (selection?.recommended) {
    const names = recommendedNames(skills);
    return { names: new Set(names), toPersist: names };
  }

  if (Array.isArray(stored)) {
    return { names: new Set(stored), toPersist: null };
  }

  const names = recommendedNames(skills);
  return { names: new Set(names), toPersist: names };
}
