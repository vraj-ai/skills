import { discoverSkills } from '../discovery.js';
import { installOne, retireVanished } from '../install.js';
import { readManifest, writeManifest } from '../manifest.js';
import { readConfig } from '../config.js';
import { resolveSelection } from '../selection.js';
import { resolveClosure } from '../deps.js';

export async function runUpdate({ names, repoRoot, installRoot, targets, force = false }) {
  const { skills, warnings: discoveryWarnings } = await discoverSkills(repoRoot);
  const manifest = await readManifest(installRoot);
  // A whole-install update honours the persisted selection exactly like init
  // does — same resolution, same dependency closure — so a deselected skill is
  // retired instead of being refreshed forever. Named updates stay explicit,
  // and an install with no stored selection keeps its pre-selection behaviour.
  const stored = names.length > 0 ? null : (await readConfig(installRoot)).selection;
  // Roots are what the user asked to own. The install set is their dependency
  // closure, so a dependency added to a skill since the last install is
  // installed by the same update that refreshes its dependent.
  let roots;
  let keep = null;
  if (names.length > 0) {
    roots = names;
  } else if (stored) {
    // A selected name that left the repo is the ordinary retirement case, not
    // a broken graph — only what is still discoverable gets resolved.
    roots = [...resolveSelection({ skills, selection: null, stored }).names].filter((name) => skills.has(name));
  } else {
    roots = Object.keys(manifest.skills);
  }
  const { order, errors } = resolveClosure(skills, roots);
  if (stored) {
    // Unlike init, this keep-set decides what gets retired on a path that also
    // rewrites the manifest, and a dropped branch silently shrinks it. A broken
    // graph stops the run before anything is installed, retired or written.
    if (errors.length > 0) {
      return {
        ok: false,
        results: [],
        messages: [
          ...discoveryWarnings,
          ...errors.map((err) => (err.cycle
            ? `dependency cycle detected: ${err.cycle.join(' -> ')}`
            : `unknown dependency "${err.missing}" referenced`)),
          'update stopped before changing anything: the selected dependency graph is invalid. Fix it, or update a single skill by name.',
        ],
        discoveryWarnings,
        linkFailures: [],
      };
    }
    keep = new Set(order);
  }
  // A cycle makes the install order unknowable, so the run stops. A missing
  // dependency only drops its own branch, and the rest of the closure still
  // installs. That matches init, which keeps the depender and warns.
  const graphErrors = [...discoveryWarnings];
  if (errors.some((err) => err.cycle)) {
    return {
      ok: false,
      results: [],
      messages: [
        ...discoveryWarnings,
        ...errors.map((err) => (err.cycle
          ? `dependency cycle detected: ${err.cycle.join(' -> ')}`
          : `unknown dependency "${err.missing}" referenced`)),
        'update stopped before changing anything: the dependency graph is invalid.',
      ],
      discoveryWarnings,
      linkFailures: [],
    };
  }
  graphErrors.push(...errors.map((err) => `unknown dependency "${err.missing}" referenced`));
  // Only an explicit `update <name>` of a skill this machine never had is a
  // mistake worth naming. Under a persisted selection, a closure member the
  // manifest lacks is a new skill or a new dependency, which is exactly what
  // this command installs.
  const explicit = names.length > 0 ? new Set(names) : null;
  const targetNames = order.length > 0 ? order : roots.filter((name) => skills.has(name));

  const results = [];
  const messages = [...graphErrors];
  const linkFailures = [];

  for (const name of targetNames) {
    const skill = skills.get(name);
    if (!skill) continue;
    if (explicit?.has(name) && !manifest.skills[name]) {
      messages.push(`${name}: not currently installed — use "vskills add ${name}" instead`);
      continue;
    }
    const { status, warnings, linkFailures: failures } = await installOne({
      skill, installRoot, targets, manifest, force,
    });
    results.push({ name, status });
    messages.push(...warnings.map((w) => `${name}: ${w}`));
    linkFailures.push(...failures);
    if (status === 'drifted') {
      messages.push(`${name}: locally modified — skipped (use --force to overwrite)`);
    }
  }

  const vanished = await retireVanished({
    discoveredNames: new Set([...skills.keys()].filter((name) => !keep || keep.has(name))),
    installRoot,
    targets,
    manifest,
    // A named update installs its closure but retires only the names asked for.
    onlyNames: explicit,
  });
  results.push(...vanished.results);
  messages.push(...vanished.messages);

  await writeManifest(installRoot, manifest);
  return { ok: linkFailures.length === 0, results, messages, discoveryWarnings, linkFailures };
}
