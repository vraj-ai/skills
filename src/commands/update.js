import { discoverSkills } from '../discovery.js';
import { installOne } from '../install.js';
import { readManifest, writeManifest } from '../manifest.js';

export async function runUpdate({ names, repoRoot, installRoot, targets, force = false }) {
  const { skills, warnings: discoveryWarnings } = await discoverSkills(repoRoot);
  const manifest = await readManifest(installRoot);
  const targetNames = names.length > 0 ? names : Object.keys(manifest.skills);

  const results = [];
  const messages = [...discoveryWarnings];
  const linkFailures = [];

  for (const name of targetNames) {
    if (!manifest.skills[name]) {
      messages.push(`${name}: not currently installed — use "vskills add ${name}" instead`);
      continue;
    }
    const skill = skills.get(name);
    if (!skill) {
      messages.push(`${name}: no longer exists in the repo — left installed as-is`);
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

  await writeManifest(installRoot, manifest);
  return { ok: linkFailures.length === 0, results, messages, discoveryWarnings, linkFailures };
}
