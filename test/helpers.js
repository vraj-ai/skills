import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function makeTmpDir(prefix = 'vskills-test-') {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function writeSkill(repoRoot, relDir, { name, description = '', dependencies = [], body = 'Body text.', version = null }) {
  const dir = path.join(repoRoot, relDir);
  await mkdir(dir, { recursive: true });
  const versionLine = version ? `version: ${version}\n` : '';
  const depsLine = dependencies.length > 0 ? `dependencies: [${dependencies.join(', ')}]\n` : '';
  const content = `---\nname: ${name}\n${versionLine}description: ${description}\n${depsLine}---\n\n${body}\n`;
  await writeFile(path.join(dir, 'SKILL.md'), content, 'utf8');
  return dir;
}

export async function cleanup(...dirs) {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
}

const execFileAsync = promisify(execFile);

// Shared by every parallel-runner fork's suite. `parallel/` and `ship-parallel/`
// are near-identical forks (see #30), so the fixture that exercises them has to
// be one copy — duplicating it is how the fork went untested in the first place.
export async function git(repo, ...args) {
  return execFileAsync('git', ['-C', repo, ...args]);
}

export async function setupParallelFixture(root) {
  const repo = path.join(root, 'repo');
  await fs.mkdir(repo);
  await execFileAsync('git', ['init', '-b', 'main', repo]);
  await git(repo, 'config', 'user.name', 'Test Agent');
  await git(repo, 'config', 'user.email', 'test@example.com');
  await fs.writeFile(path.join(repo, 'README.md'), 'base\n');
  await git(repo, 'add', 'README.md');
  await git(repo, 'commit', '-m', 'base');

  const fake = path.join(root, 'fake-opencode.mjs');
  await fs.writeFile(fake, `#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const dir = args[args.indexOf('--dir') + 1];
const model = args[args.indexOf('--model') + 1];
const prompt = args.at(-1);
const permission = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT).agent.build.permission;
if (prompt.includes('Resolve the active merge')) {
  writeFileSync(dir + '/shared.txt', 'resolved\\n');
  execFileSync('git', ['-C', dir, 'add', 'shared.txt']);
  console.log('RESULT: PASS');
} else if (!prompt.includes('T0 ')) {
  if (permission.task !== 'deny' || permission.edit !== 'allow' || permission.external_directory !== 'allow') process.exit(20);
  const name = prompt.includes('shared.txt') ? 'shared.txt' : (prompt.includes('done-b.txt') ? 'done-b.txt' : 'done-a.txt');
  const content = prompt.includes('conflict-b') ? 'b\\n' : (prompt.includes('conflict-a') ? 'a\\n' : 'done\\n');
  writeFileSync(dir + '/' + name, content);
  execFileSync('git', ['-C', dir, 'add', name]);
  execFileSync('git', ['-C', dir, 'commit', '-m', 'build ' + name]);
  console.log('RESULT: PASS');
} else {
  if (permission.task !== 'deny' || permission.edit !== 'deny' || permission.external_directory !== 'deny') process.exit(21);
  if (process.env.FAKE_MUTATE_REF === '1' && model.includes('grok')) {
    execFileSync('git', ['-C', dir, 'update-ref', 'refs/heads/goals/demo/a', 'HEAD^']);
  }
  if (process.env.FAKE_HIDE_MUTATION === '1' && model.includes('grok')) {
    execFileSync('git', ['-C', dir, 'update-index', '--assume-unchanged', 'README.md']);
    writeFileSync(dir + '/README.md', 'hidden mutation\\n');
  }
  console.log('VERDICT: PASS');
  if (process.env.FAKE_MALFORMED === '1') {
    console.log('FINDINGS: [{"severity":"P1"}]');
    console.log('FOLLOWUPS: []');
    process.exit(0);
  }
  console.log(process.env.FAKE_BLOCKING === '1'
    ? 'FINDINGS: [{"severity":"P1","file":"x:1","trigger":"x","wrong_behavior":"y"}]'
    : 'FINDINGS: []');
  console.log('FOLLOWUPS: []');
  if (process.env.FAKE_TRAILING_PROSE === '1') console.log('This is not part of the required footer.');
}
`);
  await fs.chmod(fake, 0o755);
  return { repo, fake, worktrees: path.join(repo, 'CONTEXT', 'worktrees', 'demo') };
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
