import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const lock = join(tmpdir(), 'canon-astro-build.lock');

/**
 * Builds the site into a fresh temporary folder and returns it. Astro keeps
 * its working files in one `.astro` folder, so two builds at once break each
 * other. Test files run in parallel, so builds take turns through a lock.
 */
export function buildSite(prefix: string): string {
  const out = mkdtempSync(join(tmpdir(), `${prefix}-`));
  const wait = new Int32Array(new SharedArrayBuffer(4));
  const until = Date.now() + 280_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      if (Date.now() > until) throw new Error('Another build held the lock for too long.');
      Atomics.wait(wait, 0, 0, 250);
    }
  }
  try {
    execFileSync('npx', ['astro', 'build', '--outDir', out], { cwd: root, stdio: 'pipe' });
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
  return out;
}
