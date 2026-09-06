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
  let keep = null;
  if (stored) {
    // A selected name that left the repo is the ordinary retirement case, not
    // a broken graph — only what is still discoverable gets resolved.
    const selected = [...resolveSelection({ skills, selection: null, stored }).names].filter((name) => skills.has(name));
    const { order, errors } = resolveClosure(skills, selected);
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
  const targetNames = names.length > 0
    ? names
    : Object.keys(manifest.skills).filter((name) => !keep || keep.has(name));

  const results = [];
  const messages = [...discoveryWarnings];
  const linkFailures = [];

  for (const name of targetNames) {
    if (!manifest.skills[name]) {
      messages.push(`${name}: not currently installed — use "vskills add ${name}" instead`);
      continue;
    }
    const skill = skills.get(name);
    if (!skill) continue;
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
    onlyNames: names.length > 0 ? new Set(names) : null,
  });
  results.push(...vanished.results);
  messages.push(...vanished.messages);

  await writeManifest(installRoot, manifest);
  return { ok: linkFailures.length === 0, results, messages, discoveryWarnings, linkFailures };
}
