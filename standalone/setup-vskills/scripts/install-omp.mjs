#!/usr/bin/env node
import { installOmp } from './install-harness.mjs';

// Writes into the user's harness config, so it needs explicit approval.
if (!process.argv.includes('--install')) {
  console.error('usage: install-omp.mjs --install\nThis writes to the user omp agents dir ($OMP_AGENTS_DIR). Re-run with --install once the user has approved it.');
  process.exit(1);
}

const result = await installOmp();
for (const entry of result.results) {
  console.log(`${entry.status.padEnd(10)} ${entry.path}`);
}
console.log(`Installed omp Role templates to ${result.agentsDir}.`);
