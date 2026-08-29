#!/usr/bin/env node
import { installOmp } from './install-harness.mjs';

const result = await installOmp();
for (const entry of result.results) {
  console.log(`${entry.status.padEnd(10)} ${entry.path}`);
}
console.log(`Installed omp Role templates to ${result.agentsDir}.`);
