#!/usr/bin/env node
// Installs the skill packs vskills runs beside: pstack, Addy Osmani, Matt
// Pocock. Each pack is a git checkout; each of its skills is linked into the
// install root, then into every agent target, the same way vskills links its
// own catalogue. Re-running pulls cached checkouts, so it is also the update.
//
//   node install-packs.mjs            # link new skills, report anything in the way
//   node install-packs.mjs --force    # also replace what is in the way (backed up first)
//
// VSKILLS_PACK_<ID>=<dir> uses an existing checkout as-is (never pulled).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { lstat, mkdir, readdir, readFile, realpath, rename, symlink, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Order is priority: when two packs ship the same skill name, the earlier
// pack wins and the later one is skipped. vskills' own catalogue beats all.
export const PACKS = [
  { id: 'pstack', repo: 'https://github.com/cursor/plugins.git', skills: 'pstack/skills' },
  { id: 'addyosmani', repo: 'https://github.com/addyosmani/agent-skills.git', skills: 'skills' },
  { id: 'mattpocock', repo: 'https://github.com/mattpocock/skills.git', skills: 'skills', skip: ['deprecated'] },
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function checkout(pack, packsDir, log) {
  const override = process.env[`VSKILLS_PACK_${pack.id.toUpperCase()}`];
  if (override) return override;
  const dir = path.join(packsDir, pack.id);
  try {
    if (existsSync(path.join(dir, '.git'))) {
      execFileSync('git', ['-C', dir, 'pull', '--ff-only', '--quiet'], { stdio: 'pipe' });
    } else {
      execFileSync('git', ['clone', '--depth', '1', '--quiet', pack.repo, dir], { stdio: 'pipe' });
    }
  } catch (error) {
    log.push(`${pack.id}: git failed (${String(error.stderr || error.message).trim()}) — using what is on disk`);
  }
  return dir;
}

async function skillDirs(root, skip = []) {
  const found = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    if (entries.some((e) => e.isFile() && e.name === 'SKILL.md')) return found.push(dir);
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && !skip.includes(e.name)) await walk(path.join(dir, e.name));
    }
  }
  await walk(root);
  return found;
}

// Points linkPath at target. Returns 'linked', 'up-to-date', 'replaced', or
// 'blocked'. Something else at linkPath is only replaced under force: a real
// directory is moved to backupRoot first, a foreign link is just unlinked.
async function link(target, linkPath, { force, backupRoot }) {
  const existing = await lstat(linkPath).catch(() => null);
  if (existing) {
    const resolved = await realpath(linkPath).catch(() => null);
    if (resolved && resolved === (await realpath(target))) return 'up-to-date';
    if (!force) return 'blocked';
    if (existing.isSymbolicLink()) await unlink(linkPath);
    else {
      await mkdir(backupRoot, { recursive: true });
      await rename(linkPath, path.join(backupRoot, `${path.basename(linkPath)}-${timestamp()}`));
    }
  }
  await mkdir(path.dirname(linkPath), { recursive: true });
  await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  return existing ? 'replaced' : 'linked';
}

export async function installPacks({ installRoot, targets, packs = PACKS, packsDir, force = false }) {
  const log = [];
  const counts = { linked: 0, 'up-to-date': 0, replaced: 0 };
  const backupRoot = path.join(installRoot, '.vskills-backup');
  const manifest = await readFile(path.join(installRoot, '.vskills-manifest.json'), 'utf8')
    .then((raw) => JSON.parse(raw).skills ?? {})
    .catch(() => ({}));
  const owner = new Map(Object.keys(manifest).map((name) => [name, 'vskills']));

  for (const pack of packs) {
    const root = pack.dir ?? checkout(pack, packsDir, log);
    for (const dir of await skillDirs(path.join(root, pack.skills), pack.skip)) {
      const name = path.basename(dir);
      if (owner.has(name)) {
        log.push(`${pack.id}/${name}: skipped, ${owner.get(name)} owns /${name}`);
        continue;
      }
      owner.set(name, pack.id);
      const installed = path.join(installRoot, name);
      for (const [from, to] of [[dir, installed], ...targets.map((t) => [installed, path.join(t, name)])]) {
        const status = await link(from, to, { force, backupRoot });
        if (status === 'blocked') log.push(`${to}: something else is there — left untouched (--force replaces it, backing up a real directory)`);
        else counts[status] += 1;
      }
    }
  }
  return { counts, log, owner };
}

async function main() {
  const installRoot = path.join(os.homedir(), '.agents', 'skills');
  const config = await readFile(path.join(installRoot, '.vskills-config.json'), 'utf8')
    .then(JSON.parse)
    .catch(() => ({}));
  const targets = config.targets?.length ? config.targets : [path.join(os.homedir(), '.claude', 'skills')];
  const { counts, log } = await installPacks({
    installRoot,
    targets,
    packsDir: path.join(os.homedir(), '.agents', 'packs'),
    force: process.argv.includes('--force'),
  });
  for (const line of log) console.log(line);
  console.log(`install-packs: ${counts.linked} linked, ${counts.replaced} replaced, ${counts['up-to-date']} up to date`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
