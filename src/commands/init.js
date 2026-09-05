import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { discoverSkills, isDirectory } from '../discovery.js';
import { adoptOne, ensureSymlink, installOne, retireVanished } from '../install.js';
import { hashDir } from '../hash.js';
import { parseFrontmatter } from '../frontmatter.js';
import { compareVersions } from '../version.js';
import { readManifest, writeManifest } from '../manifest.js';
import { resolveClosure } from '../deps.js';

async function readInstalledVersion(installedDir) {
  try {
    const raw = await readFile(path.join(installedDir, 'SKILL.md'), 'utf8');
    const version = parseFrontmatter(raw).data.version;
    return typeof version === 'string' && version.length > 0 ? version : null;
  } catch {
    return null;
  }
}

// Init runs in three phases so a machine that already has skills (from an
// earlier run, or from someone else's installer dropping folders into the
// same install root) gets a plan instead of a wall of "drifted":
//   1. classify every skill: install / up-to-date / adopt / update / conflict
//   2. hand conflicts to `resolveConflicts` (interactive prompt in the CLI);
//      it returns the names to overwrite. Without a resolver, every conflict
//      is overwritten — but installOne always backs up unmanaged content.
//   3. apply
// selection: iterable of skill names to install; omit for all discovered.
export async function runInit({ repoRoot, installRoot, targets, resolveConflicts = null, selection = null }) {
  const { skills, warnings: discoveryWarnings } = await discoverSkills(repoRoot);
  const manifest = await readManifest(installRoot);
  // Expand through the dependency closure so a dependency of a selected
  // skill is itself selected — otherwise it gets treated as deselected and
  // retired right after this function installs the skill that needs it.
  const selectedNames = selection ? new Set(resolveClosure(skills, [...selection]).order) : new Set(skills.keys());

  const plan = [];
  for (const skill of skills.values()) {
    if (!selectedNames.has(skill.name)) continue;
    const installedDir = path.join(installRoot, skill.name);
    if (!(await isDirectory(installedDir))) {
      plan.push({ skill, action: 'install' });
      continue;
    }

    const installedHash = await hashDir(installedDir);
    const sourceHash = await hashDir(skill.dir);
    const entry = manifest.skills[skill.name];

    if (installedHash === sourceHash) {
      // Byte-identical to the repo. If we don't have a manifest record yet
      // (pre-existing copy from before vskills, or another installer),
      // adopting it silently is always safe — same content, now managed.
      plan.push({
        skill,
        action: entry?.contentHash === installedHash ? 'up-to-date' : 'adopt',
        installedHash,
      });
      continue;
    }

    if (entry && entry.contentHash === installedHash) {
      // Managed, unmodified by the user — the repo just moved on. Update.
      plan.push({ skill, action: 'update' });
      continue;
    }

    // Content differs and vskills doesn't own it (unmanaged, or locally
    // modified). Frontmatter versions are the only honest tiebreaker: a
    // strictly older installed version is an outdated copy of ours — update
    // it. Anything else (no version, equal, newer, unparseable) is a
    // conflict for the resolver.
    const installedVersion = await readInstalledVersion(installedDir);
    const repoVersion = skill.version ?? null;
    if (installedVersion && repoVersion && compareVersions(repoVersion, installedVersion) === 1) {
      plan.push({ skill, action: 'update', note: `v${installedVersion} → v${repoVersion}` });
      continue;
    }
    plan.push({ skill, action: 'conflict', installedVersion, repoVersion });
  }

  const conflicts = plan.filter((p) => p.action === 'conflict');
  let overwriteNames = new Set(conflicts.map((c) => c.skill.name));
  if (conflicts.length > 0 && resolveConflicts) {
    const chosen = await resolveConflicts(
      conflicts.map((c) => ({
        name: c.skill.name,
        installedVersion: c.installedVersion,
        repoVersion: c.repoVersion,
      }))
    );
    overwriteNames = new Set(chosen);
  }

  const results = [];
  const messages = [...discoveryWarnings];
  const linkFailures = [];

  for (const item of plan) {
    const { skill, action } = item;
    const record = (status, warnings = [], failures = []) => {
      results.push({ name: skill.name, status });
      messages.push(...warnings.map((w) => `${skill.name}: ${w}`));
      linkFailures.push(...failures);
    };

    if (action === 'up-to-date') {
      // Already managed and byte-identical: installOne's up-to-date path
      // ensures symlinks without rewriting the manifest entry, so a re-run
      // is a true no-op (installedAt stays put).
      const { warnings, linkFailures: failures } = await installOne({
        skill, installRoot, targets, manifest,
      });
      record('up-to-date', warnings, failures);
      continue;
    }

    if (action === 'adopt') {
      const { warnings, linkFailures: failures } = await adoptOne({
        skill, installRoot, targets, manifest, contentHash: item.installedHash,
      });
      record('adopted', warnings, failures);
      continue;
    }

    if (action === 'install') {
      const { warnings, linkFailures: failures } = await installOne({
        skill, installRoot, targets, manifest,
      });
      record('installed', warnings, failures);
      continue;
    }

    if (action === 'update') {
      const { warnings, linkFailures: failures } = await installOne({
        skill, installRoot, targets, manifest, force: true,
      });
      record('updated', warnings, failures);
      if (item.note) messages.push(`${skill.name}: ${item.note}`);
      continue;
    }

    // conflict
    if (overwriteNames.has(skill.name)) {
      const { warnings, linkFailures: failures } = await installOne({
        skill, installRoot, targets, manifest, force: true,
      });
      record('updated', warnings, failures);
    } else {
      const warnings = [];
      const failures = [];
      const installedDir = path.join(installRoot, skill.name);
      for (const target of targets) {
        await ensureSymlink(installedDir, target, skill.name, warnings, failures);
      }
      record('skipped', warnings, failures);
      messages.push(`${skill.name}: existing copy differs from this repo — kept yours (rerun init to revisit)`);
    }
  }

  // "Still wanted" means in the repo AND selected — a name can be in
  // `selectedNames` (stored selection) but no longer in `skills` (deleted
  // from the repo), or in `skills` but not selected. Either way it retires.
  const vanished = await retireVanished({
    discoveredNames: new Set([...skills.keys()].filter((n) => selectedNames.has(n))),
    installRoot,
    targets,
    manifest,
  });
  results.push(...vanished.results);
  messages.push(...vanished.messages);

  await writeManifest(installRoot, manifest);
  return { ok: linkFailures.length === 0, results, messages, linkFailures };

}
