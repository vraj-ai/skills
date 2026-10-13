import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function makeTmpDir(prefix = 'vskills-test-') {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function writeSkill(repoRoot, relDir, { name, description = '', dependencies = [], body = 'Body text.', version = null, recommended = null }) {
  const dir = path.join(repoRoot, relDir);
  await mkdir(dir, { recursive: true });
  const versionLine = version ? `version: ${version}\n` : '';
  const depsLine = dependencies.length > 0 ? `dependencies: [${dependencies.join(', ')}]\n` : '';
  const recommendedLine = recommended === null ? '' : `recommended: ${recommended}\n`;
  const content = `---\nname: ${name}\n${versionLine}description: ${description}\n${depsLine}${recommendedLine}---\n\n${body}\n`;
  await writeFile(path.join(dir, 'SKILL.md'), content, 'utf8');
  return dir;
}

export async function cleanup(...dirs) {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
}

// Skills are grouped into category folders (`delivery/`, `standalone/`,
// `pipeline/`, `legacy-workflow/`), so a test must not hard-code a skill's
// parent directory: regrouping one would silently break every path literal.
// Walk for the SKILL.md instead, matching what src/discovery.js accepts at any
// depth. Sync, because several suites build these paths at module scope.
export function skillPath(repoRoot, name, ...rest) {
  const stack = [repoRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === '.git' || entry.name === 'node_modules') continue;
      const child = path.join(dir, entry.name);
      if (entry.name === name && existsSync(path.join(child, 'SKILL.md'))) return path.join(child, ...rest);
      stack.push(child);
    }
  }
  throw new Error(`no skill named "${name}" under ${repoRoot}`);
}
