#!/usr/bin/env node
// CommonJS wrapper to start ESM module
(async () => {
  try {
    const { start } = await import('./dist/index.js');
    await start();
  } catch (err) {
    console.error('[Updater] Fatal error:', err);
    process.exit(1);
  }
})();
