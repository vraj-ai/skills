#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

function stripComment(value) {
  let quote = '';
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if ((char === '"' || char === "'") && value[i - 1] !== '\\') quote = quote === char ? '' : quote || char;
    if (char === '#' && !quote && (i === 0 || /\s/.test(value[i - 1]))) return value.slice(0, i).trim();
  }
  return value.trim();
}

function scalar(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  if (value === '[]') return [];
  return value;
}

export function parseReviewConfig(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const match = raw.match(/^(\s*)([^:#][^:]*):(?:\s*(.*))?$/);
    if (!match) continue;
    const indent = match[1].replace(/\t/g, '  ').length;
    const key = match[2].trim();
    const rawValue = stripComment(match[3] || '');
    while (stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1).value;
    if (!rawValue) {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = scalar(rawValue);
    }
  }
  return root;
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('usage: parse-review-config.mjs <input> <output>');
  const parsed = parseReviewConfig(await readFile(input, 'utf8'));
  await writeFile(output, `${JSON.stringify(parsed)}\n`, 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Invalid review config: ${error.message}`);
    process.exitCode = 1;
  });
}
