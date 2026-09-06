#!/usr/bin/env node
import { installOpencode } from './install-harness.mjs';

// Writes into the user's harness config, so it needs explicit approval.
if (!process.argv.includes('--install')) {
  console.error('usage: install-opencode.mjs --install\nThis writes to the user OpenCode config dir ($OPENCODE_CONFIG_DIR). Re-run with --install once the user has approved it.');
  process.exit(1);
}

const result = await installOpencode();
for (const entry of result.results) {
  console.log(`${entry.status.padEnd(10)} ${entry.path}`);
}
console.log('Restart OpenCode to load the profile.');
