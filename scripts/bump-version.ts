// scripts/bump-version.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const counterPath = path.join(repoRoot, 'config', 'build-counter.json');
const versionPath = path.join(repoRoot, 'config', 'version.json');

interface BuildCounter {
  date: string;
  counter: number;
}

function generateVersion(): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  }).replace('/', '');

  let counter: BuildCounter = { date: '', counter: 0 };

  if (fs.existsSync(counterPath)) {
    try {
      counter = JSON.parse(fs.readFileSync(counterPath, 'utf-8'));
    } catch {
      counter = { date: '', counter: 0 };
    }
  }

  if (counter.date === today) {
    counter.counter += 1;
  } else {
    counter.date = today;
    counter.counter = 1;
  }

  fs.writeFileSync(counterPath, JSON.stringify(counter));
  return `v${today}_${counter.counter}`;
}

const version = generateVersion();
const versionJson = {
  version,
  buildTime: new Date().toISOString(),
};

fs.writeFileSync(versionPath, JSON.stringify(versionJson, null, 2) + '\n');
console.log(`Version bumped to: ${version}`);
