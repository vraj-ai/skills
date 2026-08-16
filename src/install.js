import { cp, lstat, mkdir, realpath, rename, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { hashDir } from './hash.js';
import { isDirectory } from './discovery.js';

export const BACKUP_DIR_NAME = '.vskills-backup';

export function symlinkTypeForPlatform(platform) {
  return platform === 'win32' ? 'junction' : undefined;
}

function randSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '');
}

// Replaces destDir with a copy of sourceDir. The copy lands in a temp dir
// first so an interrupted copy never leaves destDir partial. When
// `backupRoot` is given, the previous destDir is preserved there instead of
// deleted (used whenever we overwrite content vskills doesn't own).
async function atomicReplaceDir(sourceDir, destDir, { backupRoot = null } = {}) {
  const tmpDir = path.join(path.dirname(destDir), `.tmp-${path.basename(destDir)}-${randSuffix()}`);
  await cp(sourceDir, tmpDir, { recursive: true });

  const destExists = await isDirectory(destDir);
  if (!destExists) {
    await rename(tmpDir, destDir);
    return null;
  }

  if (backupRoot) {
    await mkdir(backupRoot, { recursive: true });
    const backupDir = path.join(backupRoot, `${path.basename(destDir)}-${timestamp()}`);
    await rename(destDir, backupDir);
    await rename(tmpDir, destDir);
    return backupDir;
  }

  const oldDir = path.join(path.dirname(destDir), `.old-${path.basename(destDir)}-${randSuffix()}`);
  await rename(destDir, oldDir);
  await rename(tmpDir, destDir);
  await rm(oldDir, { recursive: true, force: true });
  return null;
}

export async function ensureSymlink(installedDir, targetDir, name, warnings) {
  await mkdir(targetDir, { recursive: true });
  const linkPath = path.join(targetDir, name);

  let existing;
  try {
    existing = await lstat(linkPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    await symlink(installedDir, linkPath, symlinkTypeForPlatform(process.platform));
    return;
  }

  if (!existing.isSymbolicLink()) {
    warnings.push(`${linkPath}: exists and is not a symlink vskills created — left untouched`);
    return;
  }

  const resolved = await realpath(linkPath).catch(() => null);
  const wantResolved = await realpath(installedDir);
  if (resolved !== wantResolved) {
    warnings.push(`${linkPath}: is a symlink to somewhere else — left untouched`);
  }
}

// Records an already-present, byte-identical copy as managed by vskills
// without touching its files: manifest entry + symlinks only.
export async function adoptOne({ skill, installRoot, targets, manifest, contentHash }) {
  const warnings = [];
  const installedDir = path.join(installRoot, skill.name);
  for (const target of targets) {
    await ensureSymlink(installedDir, target, skill.name, warnings);
  }
  manifest.skills[skill.name] = {
    sourcePath: skill.dir,
    contentHash,
    installedAt: new Date().toISOString(),
  };
  return { status: 'adopted', warnings };
}

// Installs or refreshes a single skill. Returns one of:
//   'installed'  — fresh install or refreshed to latest content
//   'up-to-date' — already installed, matches source, no drift
//   'drifted'    — installed copy doesn't match manifest record; left untouched (unless force)
// When force overwrites content whose hash isn't the manifest's known-good
// hash (unmanaged or locally modified), the old copy is moved into
// <installRoot>/.vskills-backup/<name>-<timestamp> rather than deleted.
export async function installOne({ skill, installRoot, targets, manifest, force = false }) {
  const warnings = [];
  const installedDir = path.join(installRoot, skill.name);
  const sourceHash = await hashDir(skill.dir);
  const existingEntry = manifest.skills[skill.name];
  const installedExists = await isDirectory(installedDir);
  let installedHash = null;

  if (installedExists) {
    installedHash = await hashDir(installedDir);
    const knownGoodHash = existingEntry?.contentHash;

    if (!force) {
      if (knownGoodHash === undefined || installedHash !== knownGoodHash) {
        return { status: 'drifted', warnings };
      }
      if (installedHash === sourceHash) {
        for (const target of targets) {
          await ensureSymlink(installedDir, target, skill.name, warnings);
        }
        return { status: 'up-to-date', warnings };
      }
    }
  }

  // Preserve anything we're about to destroy that vskills doesn't own.
  const needsBackup =
    installedExists && installedHash !== existingEntry?.contentHash && installedHash !== sourceHash;

  await mkdir(installRoot, { recursive: true });
  const backupDir = await atomicReplaceDir(skill.dir, installedDir, {
    backupRoot: needsBackup ? path.join(installRoot, BACKUP_DIR_NAME) : null,
  });
  if (backupDir) {
    warnings.push(`previous copy backed up to ${backupDir}`);
  }
  for (const target of targets) {
    await ensureSymlink(installedDir, target, skill.name, warnings);
  }

  manifest.skills[skill.name] = {
    sourcePath: skill.dir,
    contentHash: sourceHash,
    installedAt: new Date().toISOString(),
  };

  return { status: 'installed', warnings };
}
