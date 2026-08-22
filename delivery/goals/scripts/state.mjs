#!/usr/bin/env node
import { mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const FIELDS = new Set([
  'id', 'type', 'title', 'status', 'milestone', 'priority', 'source',
  'source_id', 'depends_on', 'acceptance', 'attempts', 'created_by',
]);
const STATUSES = new Set(['planned', 'ready', 'in-progress', 'blocked', 'failed', 'done', 'cancelled']);

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

async function atomicWrite(target, content) {
  const dir = path.dirname(target);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await open(temp, 'wx', 0o600);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, target);
}

function validateItems(items) {
  if (!Array.isArray(items)) fail('backlog input must be a JSON array');
  const ids = new Set();
  const sourceAttempts = new Map();
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(`item ${index} must be an object`);
    const unknown = Object.keys(item).filter((key) => !FIELDS.has(key));
    if (unknown.length) fail(`item ${index} has unsupported fields: ${unknown.join(', ')}`);
    for (const required of ['id', 'type', 'title', 'status', 'milestone', 'depends_on', 'acceptance', 'attempts', 'created_by']) {
      if (!(required in item)) fail(`item ${index} is missing ${required}`);
    }
    if (typeof item.id !== 'string' || !item.id) fail(`item ${index} has invalid id`);
    if (ids.has(item.id)) fail(`duplicate item id: ${item.id}`);
    ids.add(item.id);
    if (!STATUSES.has(item.status)) fail(`item ${item.id} has invalid status: ${item.status}`);
    if (!Array.isArray(item.depends_on)) fail(`item ${item.id} depends_on must be an array`);
    if (!Number.isInteger(item.attempts) || item.attempts < 0) fail(`item ${item.id} attempts must be a non-negative integer`);
    const sourceId = item.source_id ?? item.id;
    sourceAttempts.set(sourceId, (sourceAttempts.get(sourceId) ?? 0) + item.attempts);
  }
  for (const item of items) {
    for (const dependency of item.depends_on) {
      if (!ids.has(dependency)) fail(`item ${item.id} depends on unknown item ${dependency}`);
      if (dependency === item.id) fail(`item ${item.id} depends on itself`);
    }
  }
  for (const [sourceId, attempts] of sourceAttempts) {
    if (attempts > 2) fail(`source_id ${sourceId} exceeds the attempt cap of 2`);
  }

  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(items.map((item) => [item.id, item]));
  function visit(id, trail = []) {
    if (visited.has(id)) return;
    if (visiting.has(id)) fail(`dependency cycle detected: ${[...trail, id].join(' -> ')}`);
    visiting.add(id);
    for (const dependency of byId.get(id).depends_on) visit(dependency, [...trail, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const item of items) visit(item.id);
  return items;
}

async function readBacklog(file) {
  const raw = await readFile(file, 'utf8');
  const items = raw.split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      fail(`invalid JSON on backlog line ${index + 1}: ${error.message}`);
    }
  });
  return validateItems(items);
}

function pidIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function acquireLock(goalDir, sessionId) {
  const lockDir = path.join(goalDir, 'lock.d');
  try {
    await mkdir(lockDir);
  } catch (error) {
    if (error.code === 'EEXIST') {
      const rawOwner = await readFile(path.join(lockDir, 'owner.json'), 'utf8').catch(() => null);
      if (!rawOwner) fail('goal lock exists without owner evidence; inspect it manually', 2);
      let owner;
      try {
        owner = JSON.parse(rawOwner);
      } catch {
        fail(`goal lock owner is malformed: ${rawOwner}`, 2);
      }
      if (owner.host === os.hostname() && !pidIsAlive(owner.pid)) {
        await rm(lockDir, { recursive: true });
        return acquireLock(goalDir, sessionId);
      }
      fail(`goal is already locked: ${rawOwner}`, 2);
    }
    throw error;
  }
  const owner = {
    session_id: sessionId || `${os.hostname()}-${process.ppid}-${Date.now()}`,
    pid: Number.parseInt(process.env.GOALS_SESSION_PID ?? String(process.ppid), 10),
    lock_writer_pid: process.pid,
    host: os.hostname(),
    started_at: new Date().toISOString(),
  };
  await atomicWrite(path.join(lockDir, 'owner.json'), `${JSON.stringify(owner)}\n`);
  process.stdout.write(`${JSON.stringify(owner)}\n`);
}

async function releaseLock(goalDir, sessionId) {
  if (!sessionId) fail('unlock requires the owning session id', 3);
  const lockDir = path.join(goalDir, 'lock.d');
  const rawOwner = await readFile(path.join(lockDir, 'owner.json'), 'utf8').catch(() => null);
  if (!rawOwner) fail('cannot unlock without owner evidence', 3);
  const owner = JSON.parse(rawOwner);
  if (owner.session_id !== sessionId) fail(`lock belongs to ${owner.session_id}, not ${sessionId}`, 3);
  await rm(lockDir, { recursive: true });
}

async function main() {
  const [command, target, source] = process.argv.slice(2);
  if (!command || !target) fail('usage: state.mjs <lock|unlock|write-backlog|write-file|validate|ready> <target> [source]');

  if (command === 'lock') return acquireLock(target, source);
  if (command === 'unlock') return releaseLock(target, source);
  if (command === 'write-file') {
    if (!source) fail('write-file requires a source file');
    return atomicWrite(target, await readFile(source, 'utf8'));
  }
  if (command === 'write-backlog') {
    if (!source) fail('write-backlog requires a JSON-array source file');
    const items = validateItems(JSON.parse(await readFile(source, 'utf8')));
    return atomicWrite(target, items.map((item) => JSON.stringify(item)).join('\n') + (items.length ? '\n' : ''));
  }
  if (command === 'validate') {
    await readBacklog(target);
    return;
  }
  if (command === 'ready') {
    const items = await readBacklog(target);
    if (!source) fail('ready requires the active milestone id');
    const done = new Set(items.filter((item) => item.status === 'done').map((item) => item.id));
    const attemptsBySource = new Map();
    for (const item of items) {
      const sourceId = item.source_id ?? item.id;
      attemptsBySource.set(sourceId, (attemptsBySource.get(sourceId) ?? 0) + item.attempts);
    }
    const ready = items.filter((item) => ['planned', 'ready', 'failed'].includes(item.status)
      && item.milestone === source
      && (attemptsBySource.get(item.source_id ?? item.id) ?? 0) < 2
      && item.depends_on.every((id) => done.has(id)));
    process.stdout.write(`${JSON.stringify(ready)}\n`);
    return;
  }
  if (command === 'exists') {
    const info = await stat(target).catch(() => null);
    process.stdout.write(info ? 'true\n' : 'false\n');
    return;
  }
  fail(`unknown command: ${command}`);
}

main().catch((error) => fail(error.stack || String(error)));
