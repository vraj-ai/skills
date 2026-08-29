#!/usr/bin/env node
import { installOpencode } from './install-harness.mjs';

const result = await installOpencode();
for (const entry of result.results) {
  console.log(`${entry.status.padEnd(10)} ${entry.path}`);
}
console.log('Restart OpenCode to load the profile.');
