#!/usr/bin/env node
// `node --test` with no path arguments walks the whole tree and does not honour
// .gitignore, so a git worktree checked out under CONTEXT/worktrees/ gets its
// copy of every test file collected a second time (#29): 116 tests reported
// instead of 58, with foreign failures injected and regressions masked behind
// duplicate passes.
//
// Every scoped runner form fails somewhere across the `engines: >=18` range —
// `node --test test/` is MODULE_NOT_FOUND on 22, a quoted glob is 22-only, an
// unquoted glob silently drops subdirectories, and `$(find ...)` does not exist
// in the cmd.exe that runs `npm test` on Windows. So collect the files here and
// hand node an explicit list: no shell globbing, same behaviour on 18 and 22.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectTestFiles(full));
    else if (entry.name.endsWith('.test.js')) files.push(full);
  }
  return files.sort();
}

async function main() {
  const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const files = await collectTestFiles(path.join(repoRoot, 'test'));

  // An empty collection must be loud. The unquoted-glob form this replaces
  // exited 0 green when it matched nothing, which is the failure mode that
  // makes a gate worse than no gate at all.
  if (files.length === 0) {
    console.error('run-tests: no *.test.js files found under test/');
    process.exit(1);
  }

  const child = spawn(process.execPath, ['--test', ...process.argv.slice(2), ...files], { stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
