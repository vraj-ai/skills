#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function parseFixResponse(raw) {
  const envelope = JSON.parse(raw);
  const content = envelope?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('model returned no content');
  }

  const parsed = JSON.parse(content.trim());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('model content is not a JSON object');
  }
  if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
    throw new Error('model response has no reply');
  }
  if (typeof parsed.patch !== 'string') {
    throw new Error('model response has no patch field');
  }
  if (/^(?:analysis\b|we need\b|need to\b|let(?:'|’)s analyze\b|we should answer\b)/i.test(parsed.reply.trim())) {
    throw new Error('model reply contains planning text');
  }
  if (parsed.patch && !parsed.patch.startsWith('diff --git ')) {
    throw new Error('model patch is not a git unified diff');
  }

  return {
    reply: parsed.reply.trim(),
    patch: parsed.patch,
    notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
  };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    throw new Error('usage: parse-fix-response.mjs <input> <output>');
  }
  const parsed = parseFixResponse(await readFile(input, 'utf8'));
  await writeFile(output, `${JSON.stringify(parsed)}\n`, 'utf8');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(`Invalid fix response: ${error.message}`);
    process.exitCode = 1;
  });
}
