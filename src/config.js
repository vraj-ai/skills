import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function defaultTargets() {
  return [path.join(os.homedir(), '.claude', 'skills')];
}

export function configPath(installRoot) {
  return path.join(installRoot, '.vskills-config.json');
}

export async function readConfig(installRoot) {
  try {
    const raw = await readFile(configPath(installRoot), 'utf8');
    const parsed = JSON.parse(raw);
    const targets = Array.isArray(parsed.targets) && parsed.targets.length > 0
      ? parsed.targets
      : defaultTargets();
    // An empty array is corrupt state we wrote ourselves (the now-fixed
    // empty-selection bug), not a deliberate "select nothing" — treat it the
    // same as null so it falls through to the normal derivation and self-heals.
    const selectionArray = Array.isArray(parsed.selection)
      ? parsed.selection.filter((name) => typeof name === 'string')
      : null;
    const selection = selectionArray && selectionArray.length > 0
      ? selectionArray
      : parsed.selection === 'all'
        ? 'all'
        : null;
    return { targets, selection };
  } catch (err) {
    if (err.code === 'ENOENT') return { targets: defaultTargets(), selection: null };
    throw err;
  }
}

// Merges onto whatever is already on disk so writing `selection` never drops
// a hand-edited `targets` (or vice versa).
export async function writeConfig(installRoot, patch) {
  let current = {};
  try {
    current = JSON.parse(await readFile(configPath(installRoot), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const next = { ...current, ...patch };
  await mkdir(installRoot, { recursive: true });
  await writeFile(configPath(installRoot), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}
