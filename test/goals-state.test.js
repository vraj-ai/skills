import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, makeTmpDir } from './helpers.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stateScript = path.resolve(__dirname, '..', 'goals', 'scripts', 'state.mjs');

function item(overrides) {
  return {
    id: 'A',
    type: 'code',
    title: 'Build A',
    status: 'planned',
    milestone: 'M1',
    priority: 1,
    source: 'plan',
    source_id: 'A',
    depends_on: [],
    acceptance: 'node --test',
    attempts: 0,
    created_by: 'goals',
    ...overrides,
  };
}

test('state helper atomically writes, validates, and computes ready backlog items', async () => {
  const root = await makeTmpDir('goals-state-');
  try {
    const goalDir = path.join(root, 'goal');
    const source = path.join(root, 'items.json');
    const backlog = path.join(goalDir, 'backlog.jsonl');
    await fs.writeFile(source, JSON.stringify([
      item({ id: 'A', status: 'done' }),
      item({ id: 'B', title: 'Build B', source_id: 'B', depends_on: ['A'] }),
      item({ id: 'C', title: 'Build C', source_id: 'C', depends_on: ['B'] }),
    ]));

    await execFileAsync(process.execPath, [stateScript, 'write-backlog', backlog, source]);
    await execFileAsync(process.execPath, [stateScript, 'validate', backlog]);
    const { stdout } = await execFileAsync(process.execPath, [stateScript, 'ready', backlog, 'M1']);
    assert.deepEqual(JSON.parse(stdout).map((entry) => entry.id), ['B']);

    const lines = (await fs.readFile(backlog, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 3);
    assert.equal(JSON.parse(lines[1]).id, 'B');
  } finally {
    await cleanup(root);
  }
});

test('state helper enforces the source attempt cap and exclusive lock', async () => {
  const root = await makeTmpDir('goals-state-');
  try {
    const source = path.join(root, 'items.json');
    await fs.writeFile(source, JSON.stringify([item({ attempts: 3 })]));
    await assert.rejects(
      execFileAsync(process.execPath, [stateScript, 'write-backlog', path.join(root, 'backlog.jsonl'), source]),
      (error) => error.code === 1 && /attempt cap/.test(error.stderr),
    );

    await fs.mkdir(path.join(root, 'goal'));
    await execFileAsync(process.execPath, [stateScript, 'lock', path.join(root, 'goal'), 'session-a']);
    await assert.rejects(
      execFileAsync(process.execPath, [stateScript, 'lock', path.join(root, 'goal'), 'session-b']),
      (error) => error.code === 2 && /already locked/.test(error.stderr),
    );
    await assert.rejects(
      execFileAsync(process.execPath, [stateScript, 'unlock', path.join(root, 'goal'), 'session-b']),
      (error) => error.code === 3 && /lock belongs/.test(error.stderr),
    );
    await execFileAsync(process.execPath, [stateScript, 'unlock', path.join(root, 'goal'), 'session-a']);
    await assert.rejects(fs.access(path.join(root, 'goal', 'lock.d')));
  } finally {
    await cleanup(root);
  }
});

test('state helper prevents cross-milestone readiness, source budget resets, and dependency cycles', async () => {
  const root = await makeTmpDir('goals-state-');
  try {
    const backlog = path.join(root, 'backlog.jsonl');
    const source = path.join(root, 'items.json');
    await fs.writeFile(source, JSON.stringify([
      item({ id: 'A', status: 'done', attempts: 2, source_id: 'shared' }),
      item({ id: 'B', source_id: 'shared', milestone: 'M1' }),
      item({ id: 'C', source_id: 'C', milestone: 'M2' }),
    ]));
    await execFileAsync(process.execPath, [stateScript, 'write-backlog', backlog, source]);
    const { stdout } = await execFileAsync(process.execPath, [stateScript, 'ready', backlog, 'M1']);
    assert.deepEqual(JSON.parse(stdout), []);

    await fs.writeFile(source, JSON.stringify([
      item({ id: 'A', source_id: 'A', depends_on: ['B'] }),
      item({ id: 'B', source_id: 'B', depends_on: ['A'] }),
    ]));
    await assert.rejects(
      execFileAsync(process.execPath, [stateScript, 'write-backlog', backlog, source]),
      (error) => error.code === 1 && /dependency cycle/.test(error.stderr),
    );
  } finally {
    await cleanup(root);
  }
});
