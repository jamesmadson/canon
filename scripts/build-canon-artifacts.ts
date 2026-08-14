import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { buildCanonAll, type CanonAllKit } from '../src/lib/buildCanonAll';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ROUTED = [
  { slug: 'marketing-site', title: 'Marketing / Landing Site' },
  { slug: 'product-ui', title: 'Product UI / Dashboard' },
  { slug: 'mobile-first-review', title: 'Mobile-First Review' },
];

function digestPath(slug: string): string {
  return path.join(root, 'public/kits', `${slug}-digest.md`);
}

// 1. Copy each routed digest verbatim into its plugin skill folder.
for (const { slug } of ROUTED) {
  const source = readFileSync(digestPath(slug), 'utf-8');
  const dir = path.join(root, 'plugin/canon/skills', `canon-${slug}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), source);
  console.log(`✓ plugin skill canon-${slug}`);
}

// 2. Build canon-all from the router body plus each digest body.
const routerRaw = readFileSync(path.join(root, 'plugin/canon/skills/canon/SKILL.md'), 'utf-8');
const routerBody = matter(routerRaw).content;

const kits: CanonAllKit[] = ROUTED.map(({ slug, title }) => ({
  slug,
  title,
  body: matter(readFileSync(digestPath(slug), 'utf-8')).content,
}));

const canonAll = buildCanonAll({ routerBody, kits });
writeFileSync(path.join(root, 'public/kits/canon-all.md'), canonAll);

const lines = canonAll.split('\n').length;
console.log(`✓ canon-all.md (${lines} lines)`);
if (lines > 500) {
  console.error(`!! canon-all is ${lines} lines — over the Agent Skills 500-line recommendation`);
  process.exit(1);
}
