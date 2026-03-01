/**
 * Deploy CLI
 *
 * Command-line interface for the deploy script.
 * Usage: npx tsx scripts/deploy.ts [stage|release]
 */
import { deploy, DeployTarget } from './deploy/index.js';

const validTargets = ['stage', 'release'];
const target = process.argv[2] as DeployTarget;

if (!target || !validTargets.includes(target)) {
  console.error(`Usage: npx tsx scripts/deploy.ts [${validTargets.join('|')}]`);
  process.exit(1);
}

const startTime = Date.now();
console.log(`\n=== Estelle v2 Build & Deploy (${target}) ===\n`);

deploy({ target })
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
