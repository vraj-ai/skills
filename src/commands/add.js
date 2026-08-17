import { discoverSkills } from '../discovery.js';
import { resolveClosure } from '../deps.js';
import { installOne } from '../install.js';
import { readManifest, writeManifest } from '../manifest.js';

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

  return {
    ok: errors.length === 0 && linkFailures.length === 0,
    results,
    messages,
    discoveryWarnings,
    linkFailures,
  };
}
