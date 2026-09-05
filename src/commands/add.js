import { discoverSkills } from '../discovery.js';
import { resolveClosure } from '../deps.js';
import { installOne } from '../install.js';
import { readManifest, writeManifest } from '../manifest.js';
import { readConfig, writeConfig } from '../config.js';

export async function runAdd({ names, repoRoot, installRoot, targets }) {
  const { skills, warnings: discoveryWarnings } = await discoverSkills(repoRoot);

  const missing = names.filter((n) => !skills.has(n));
  if (missing.length > 0) {
    return {
      ok: false,
      results: [],
      messages: [`unknown skill(s): ${missing.join(', ')}`],
      discoveryWarnings,
    };
  }

  const { order, errors } = resolveClosure(skills, names);
  const messages = [...discoveryWarnings];
  for (const err of errors) {
    if (err.cycle) {
      messages.push(`dependency cycle detected: ${err.cycle.join(' -> ')} — nothing in this cycle was installed`);
    } else if (err.missing) {
      messages.push(`unknown dependency "${err.missing}" referenced — that branch was skipped`);
    }
  }

  const manifest = await readManifest(installRoot);
  const results = [];
  const linkFailures = [];
  for (const name of order) {
    const skill = skills.get(name);
    const { status, warnings, linkFailures: failures } = await installOne({
      skill, installRoot, targets, manifest,
    });
    results.push({ name, status });
    messages.push(...warnings.map((w) => `${name}: ${w}`));
    linkFailures.push(...failures);
  }
  await writeManifest(installRoot, manifest);

  // A stored selection is init's install list — a later plain `init` would
  // otherwise retire what `add` just installed. No selection stored, or the
  // 'all' sentinel, already covers everything, so there's nothing to add to.
  // The 'recommended' sentinel does NOT cover an opt-in skill, so it has to
  // become an explicit list here: the tier as it stands today plus what was
  // just added. That gives up the tier subscription, which is the cost of
  // pinning a skill the tier does not include.
  const { selection: storedSelection } = await readConfig(installRoot);
  const base = storedSelection === 'recommended'
    ? [...skills.values()].filter((s) => s.recommended).map((s) => s.name)
    : Array.isArray(storedSelection) ? storedSelection : null;
  if (base) {
    const merged = new Set([...base, ...order]);
    await writeConfig(installRoot, { selection: [...merged] });
  }

  return {
    ok: errors.length === 0 && linkFailures.length === 0,
    results,
    messages,
    discoveryWarnings,
    linkFailures,
  };
}
