/**
 * Deploy CLI
 *
 * Command-line interface for the deploy script.
 * Usage: npx tsx scripts/deploy.ts [stage|release] [--pylon-only]
 */
import { deploy, DeployTarget } from './deploy/index.js';

const validTargets = ['stage', 'release'];
const target = process.argv[2] as DeployTarget;
const pylonOnly = process.argv.includes('--pylon-only');

if (!target || !validTargets.includes(target)) {
  console.error(`Usage: npx tsx scripts/deploy.ts [${validTargets.join('|')}] [--pylon-only]`);
  process.exit(1);
}

const startTime = Date.now();
const mode = pylonOnly ? 'Pylon only' : 'Full';
console.log(`\n=== Estelle v2 Build & Deploy (${target}, ${mode}) ===\n`);

deploy({ target, pylonOnly })
  .then((result) => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    if (result.success) {
      console.log(`\n=== Deploy Complete (${target}) - ${elapsed}s ===`);
      console.log(`  Version: ${result.version}`);
    } else {
      console.error(`\n[ERROR] ${result.error}`);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(`\n[ERROR] ${err.message}`);
    process.exit(1);
  });
