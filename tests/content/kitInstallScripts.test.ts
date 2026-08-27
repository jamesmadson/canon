import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { buildInstallScript } from '../../src/lib/buildInstallScript';
import { collectKitSkills, type SkillLike } from '../../src/lib/collectKitSkills';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

type SkillData = SkillLike;

function loadAll<T>(dir: string): T[] {
  const full = path.join(root, dir);
  return readdirSync(full)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => matter(readFileSync(path.join(full, f), 'utf-8')).data as T);
}

const skills = loadAll<SkillData>('src/content/skills');
const skillsBySlug = new Map(skills.map((s) => [s.slug, s]));

type KitData = {
  slug: string;
  name: string;
  status: string;
  phases: { entries: { skill: string }[] }[];
};

const kits = loadAll<KitData>('src/content/kits').filter((k) => k.status === 'active');

/**
 * Builds the real script users download — same collectKitSkills the
 * install.sh route calls, so this cannot drift from what ships.
 */
function scriptFor(kit: KitData): string {
  const inputs = collectKitSkills(kit, skillsBySlug);
  return buildInstallScript({ slug: kit.slug, name: kit.name, skills: inputs });
}

describe('generated kit install scripts', () => {
  it('covers every active kit', () => {
    expect(kits.length).toBeGreaterThan(0);
  });

  for (const kit of kits) {
    const script = scriptFor(kit);
    const installLines = script
      .split('\n')
      .filter((l) => l.trim().startsWith('install_skill '));

    it(`${kit.slug}: is valid bash`, () => {
      // `bash -n` parses without executing. A script that cannot parse is
      // broken for every user who runs it, and nothing else here would catch it.
      expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow();
    });

    it(`${kit.slug}: installs at least one skill`, () => {
      // A kit whose skills were all hidden would still render a page and offer
      // a download that silently does nothing.
      expect(installLines.length).toBeGreaterThan(0);
    });

    it(`${kit.slug}: installs no skill that is not active`, () => {
      const hidden = skills.filter((s) => s.status !== 'active');
      for (const skill of hidden) {
        const { owner, repo } = parseRepo(skill.sourceUrl);
        const spec = `${owner}/${repo}`;
        const offenders = installLines.filter((l) => l.includes(spec));
        expect(
          offenders,
          `${kit.slug} would clone ${spec} for hidden skill ${skill.slug}`
        ).toEqual([]);
      }
    });

    it(`${kit.slug}: every install line names a well-formed repo`, () => {
      for (const line of installLines) {
        const spec = line.trim().split(/\s+/)[1];
        expect(spec, `malformed repo spec in: ${line}`).toMatch(/^[\w.-]+\/[\w.-]+$/);
      }
    });

    it(`${kit.slug}: install lines match the kit's active skill count`, () => {
      const active = kit.phases
        .flatMap((p) => p.entries)
        .filter((e) => skillsBySlug.get(e.skill)?.status === 'active');
      const companionTotal = active.reduce(
        (n, e) => n + (skillsBySlug.get(e.skill)?.companionPaths?.length ?? 0),
        0
      );
      expect(installLines.length).toBe(active.length + companionTotal);
    });
  }
});

function parseRepo(sourceUrl: string): { owner: string; repo: string } {
  const m = sourceUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!m) throw new Error(`cannot parse repo from ${sourceUrl}`);
  return { owner: m[1], repo: m[2] };
}
