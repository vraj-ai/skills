import path from 'node:path';
import { discoverSkills, isDirectory } from '../discovery.js';
import { readManifest } from '../manifest.js';
import { hashDir } from '../hash.js';

export async function runList({ repoRoot, installRoot }) {
  const { skills, warnings } = await discoverSkills(repoRoot);
  const manifest = await readManifest(installRoot);

  const rows = [];
  for (const name of [...skills.keys()].sort()) {
    const skill = skills.get(name);
    const entry = manifest.skills[name];
    let status = 'not-installed';

    if (entry) {
      const installedDir = path.join(installRoot, name);
      if (!(await isDirectory(installedDir))) {
        status = 'missing';
      } else {
        const installedHash = await hashDir(installedDir);
        status = installedHash === entry.contentHash ? 'installed' : 'drifted';
      }
    }

    rows.push({
      name,
      status,
      description: skill.description,
      tier: skill.recommended ? 'recommended' : 'opt-in',
    });
  }

  return { rows, warnings };
}
