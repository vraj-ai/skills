import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter, FrontmatterError } from './frontmatter.js';

const SKIP_DIRS = new Set(['.git', 'node_modules']);

async function findSkillMdFiles(root) {
  const found = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        found.push(dir);
      }
    }
  }
  await walk(root);
  return found;
}

// Discovers every skill in the repo, keyed by its frontmatter `name` (not its
// path) so a nested category skill is addressable the same way a root one is.
export async function discoverSkills(repoRoot) {
  const skillDirs = await findSkillMdFiles(repoRoot);
  const byName = new Map();
  const warnings = [];
  const seenAt = new Map();

  for (const dir of skillDirs) {
    const skillMdPath = path.join(dir, 'SKILL.md');
    let content;
    try {
      content = await readFile(skillMdPath, 'utf8');
    } catch (err) {
      warnings.push(`${skillMdPath}: could not read (${err.message})`);
      continue;
    }

    let parsed;
    try {
      parsed = parseFrontmatter(content);
    } catch (err) {
      if (err instanceof FrontmatterError) {
        warnings.push(`${skillMdPath}: malformed frontmatter (${err.message})`);
        continue;
      }
      throw err;
    }

    const { name, description } = parsed.data;
    if (!name || typeof name !== 'string') {
      warnings.push(`${skillMdPath}: missing required "name" field`);
      continue;
    }

    let dependencies = parsed.data.dependencies ?? [];
    if (!Array.isArray(dependencies)) {
      warnings.push(`${skillMdPath}: "dependencies" must be a list, got ${JSON.stringify(dependencies)}`);
      continue;
    }

    if (seenAt.has(name)) {
      warnings.push(
        `duplicate skill name "${name}": ${seenAt.get(name)} and ${dir} both declare it — neither is usable until resolved`
      );
      byName.delete(name);
      seenAt.set(name, seenAt.get(name)); // keep first-seen path recorded for future collision messages
      continue;
    }
    seenAt.set(name, dir);

    const version = parsed.data.version;
    byName.set(name, {
      name,
      description: description ?? '',
      dependencies,
      version: typeof version === 'string' && version.length > 0 ? version : null,
      dir,
    });
  }

  return { skills: byName, warnings };
}

export async function isDirectory(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
