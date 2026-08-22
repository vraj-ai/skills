import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillPath } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(__dirname, '..');

const models = {
  'contributor.md': 'opencode-go/glm-5.2',
  'council-grok.md': 'opencode-go/grok-4.5',
  'council-kimi.md': 'openrouter/moonshotai/kimi-k3',
  'council-qwen.md': 'openrouter/qwen/qwen3.8-max',
  'council-sol.md': 'openai/gpt-5.6-sol',
  'council-gemini.md': 'openrouter/google/gemini-3.6-flash',
  'council-deepseek.md': 'openrouter/deepseek/deepseek-v4-flash-0731',
  'council-glm.md': 'opencode-go/glm-5.2',
  'council-adversary.md': 'opencode-go/grok-4.5',
};

test('OpenCode profile pins the selected models and a one-level spawn tree', async () => {
  const goals = await fs.readFile(path.join(repo, 'opencode', 'agent', 'goals.md'), 'utf8');
  assert.match(goals, /mode: primary/);
  assert.match(goals, /task: allow/);
  const council = await fs.readFile(path.join(repo, 'opencode', 'agent', 'council.md'), 'utf8');
  assert.match(council, /mode: primary/);
  assert.match(council, /task: allow/);
  assert.match(council, /edit: deny/);
  assert.match(council, /bash: deny/);

  for (const [file, model] of Object.entries(models)) {
    const content = await fs.readFile(path.join(repo, 'opencode', 'agent', file), 'utf8');
    assert.match(content, /mode: subagent/);
    assert.match(content, /task: deny/);
    assert.ok(content.includes(`model: ${model}`));
    assert.match(content, /webfetch: allow/);
    assert.match(content, /websearch: allow/);
    assert.match(content, /mcp_\*: allow/);
    if (file !== 'contributor.md') {
      assert.match(content, /bash: deny/);
      assert.match(content, /edit: deny/);
      assert.match(content, /external_directory: deny/);
    }
  }

  const adversary = await fs.readFile(path.join(repo, 'opencode', 'agent', 'council-adversary.md'), 'utf8');
  assert.match(adversary, /edit: deny/);
  const contributor = await fs.readFile(path.join(repo, 'opencode', 'agent', 'contributor.md'), 'utf8');
  assert.match(contributor, /edit: allow/);
});

test('workflow skills preserve the required phase and result contracts', async () => {
  const goals = await fs.readFile(skillPath(repo, 'goals', 'SKILL.md'), 'utf8');
  for (const marker of ['Phase R', 'Phase 0', 'Phase B', 'Execution loop', 'T1:', 'T2 and T3', 'backlog.jsonl']) {
    assert.ok(goals.includes(marker), `goals skill is missing ${marker}`);
  }
  const parallel = await fs.readFile(skillPath(repo, 'parallel', 'SKILL.md'), 'utf8');
  for (const marker of ['MAX_BATCH', 'STRICT_BATCH', 'results.json', '<id>.digest.json', 'opencode-go/glm-5.2']) {
    assert.ok(parallel.includes(marker), `parallel skill is missing ${marker}`);
  }
});

test('OpenCode profile exposes goal as a command and council as a selectable primary', async () => {
  const goal = await fs.readFile(path.join(repo, 'opencode', 'command', 'goal.md'), 'utf8');
  assert.match(goal, /agent: goals/);
  await assert.doesNotReject(fs.access(path.join(repo, 'opencode', 'agent', 'council.md')));
  await assert.rejects(fs.access(path.join(repo, 'opencode', 'command', 'council.md')));
});
