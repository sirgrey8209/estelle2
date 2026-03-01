// scripts/deploy/version.ts
import fs from 'fs';

interface BuildCounter {
  date: string;
  counter: number;
}

export function generateVersion(counterPath: string): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  }).replace('/', '');

  let counter: BuildCounter = { date: '', counter: 0 };

  if (fs.existsSync(counterPath)) {
    try {
      const raw = fs.readFileSync(counterPath, 'utf-8');
      counter = JSON.parse(raw);
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
