/**
 * Version Generator for Deploy Process
 *
 * Generates build versions in the format: vMMDD_N
 * - MM: Two-digit month (01-12)
 * - DD: Two-digit day (01-31)
 * - N: Build counter for the day (1, 2, 3, ...)
 *
 * The counter resets to 1 when a new day begins.
 * Used to create unique, chronologically sortable version identifiers
 * for each deployment build.
 */
import fs from 'fs';
import path from 'path';

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

  const dir = path.dirname(counterPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(counterPath, JSON.stringify(counter));

  return `v${today}_${counter.counter}`;
}
