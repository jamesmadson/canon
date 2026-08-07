# Skill Structure Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-skill "structure map" to each skill's detail page — `SKILL.md` rendered as a hub, with a Contents branch (its own heading outline) and a Package branch (the files that ship alongside it), both hover-expandable and linking to GitHub.

**Architecture:** Three small pure functions (`parseSourceUrl`, `parseSkillHeadings`, `groupFileTree`) do all the non-trivial logic and are unit-tested in isolation. A one-time script backfills real GitHub data into all 11 skills' frontmatter using the first two. The schema is tightened to require that data only *after* the backfill exists, so the build is never in a broken intermediate state. `StructureMap.astro` consumes the third function and the backfilled data to render the diagram.

**Tech Stack:** Astro 5 + TypeScript (strict) + Zod (content collections) + Vitest (pure-function tests) + `gh` CLI (one-time data fetch, not part of the build).

## Global Constraints

- No new npm dependencies. `gray-matter` (already a devDependency, already used in `tests/content/mdxCorpus.test.ts`) handles frontmatter read/write; `gh` CLI (already authenticated in this environment) handles all GitHub API calls; the fetch script runs via `npx tsx` (ephemeral, not installed).
- Section heading copy is exactly "File & content map" (locked in the spec).
- Package-branch folders show up to 3 example files then `+N more`; Contents-branch sections show up to 4 subsections then `+N more`. These exact caps come from the approved mockup — don't change them without re-checking the spec.
- CSS custom-property references inside `StructureMap.astro`'s scoped `<style>` block must use the real, prefixed token names from `src/styles/global.css`'s `@theme` block (`--color-accent-orange`, `--color-ink`, `--color-ink-soft`, `--color-rule`, `--color-rule-strong`, `--color-tile`, `--color-paper`) — not the short names (`--accent`, `--ink-soft`, ...) used in the standalone Artifact mockup.
- `StructureMap.astro` uses one scoped `<style>` block, unlike the rest of `src/components/` (which is pure Tailwind utility classes). This is a deliberate exception: the mockup's CSS is already designed, tested, and approved (including a real alignment bug that was found and fixed in it); transcribing it into Tailwind arbitrary-value utilities risks silently reintroducing that bug. Everything that maps cleanly to existing Tailwind conventions (font-mono, spacing scale) still should use Tailwind classes.
- Reference spec: `docs/superpowers/specs/2026-08-06-skill-structure-map-design.md`.

---

### Task 1: `parseSourceUrl` — extract `{owner, repo, path}` from a skill's `sourceUrl`

**Files:**
- Create: `src/lib/parseSourceUrl.ts`
- Test: `tests/lib/parseSourceUrl.test.ts`

**Interfaces:**
- Produces: `parseSourceUrl(sourceUrl: string): { owner: string; repo: string; path: string }` — `path` is `''` for a repo-root URL.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseSourceUrl } from '../../src/lib/parseSourceUrl';

describe('parseSourceUrl', () => {
  it('parses a subtree URL into owner, repo, and path', () => {
    const result = parseSourceUrl('https://github.com/anthropics/skills/tree/main/skills/frontend-design');
    expect(result).toEqual({ owner: 'anthropics', repo: 'skills', path: 'skills/frontend-design' });
  });

  it('parses a repo-root URL with an empty path', () => {
    const result = parseSourceUrl('https://github.com/dominikmartn/nothing-design-skill');
    expect(result).toEqual({ owner: 'dominikmartn', repo: 'nothing-design-skill', path: '' });
  });

  it('parses a repo-root URL whose repo name has no special characters', () => {
    const result = parseSourceUrl('https://github.com/jakubkrehel/make-interfaces-feel-better');
    expect(result).toEqual({ owner: 'jakubkrehel', repo: 'make-interfaces-feel-better', path: '' });
  });

  it('parses a subtree URL with a nested path', () => {
    const result = parseSourceUrl('https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng');
    expect(result).toEqual({ owner: 'emilkowalski', repo: 'skills', path: 'skills/emil-design-eng' });
  });

  it('throws on a non-GitHub URL', () => {
    expect(() => parseSourceUrl('https://gitlab.com/foo/bar')).toThrow();
  });

  it('throws on a malformed string', () => {
    expect(() => parseSourceUrl('not-a-url')).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/parseSourceUrl.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/parseSourceUrl'`

- [ ] **Step 3: Write the implementation**

```ts
export interface ParsedSourceUrl {
  owner: string;
  repo: string;
  path: string;
}

const SOURCE_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+))?\/?$/;

export function parseSourceUrl(sourceUrl: string): ParsedSourceUrl {
  const match = SOURCE_URL_PATTERN.exec(sourceUrl);
  if (!match) {
    throw new Error(`sourceUrl does not match the expected GitHub URL shape: ${sourceUrl}`);
  }
  const [, owner, repo, path] = match;
  return { owner, repo, path: path ?? '' };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/parseSourceUrl.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parseSourceUrl.ts tests/lib/parseSourceUrl.test.ts
git commit -m "Add parseSourceUrl for splitting a skill's GitHub sourceUrl"
```

---

### Task 2: `parseSkillHeadings` — extract `##`/`###` structure from raw `SKILL.md` text

**Files:**
- Create: `src/lib/parseSkillHeadings.ts`
- Test: `tests/lib/parseSkillHeadings.test.ts`

**Interfaces:**
- Produces: `ContentSection { title: string; subsections: string[] }`, `parseSkillHeadings(markdown: string): ContentSection[]`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseSkillHeadings } from '../../src/lib/parseSkillHeadings';

describe('parseSkillHeadings', () => {
  it('extracts flat H2 sections with no subsections', () => {
    const markdown = `# Frontend Design
## Ground it in the subject
Some text.
## Design principles
More text.
## Process: brainstorm, explore, plan, critique, build, critique again
## Restraint and self-critique
## More on writing in design
`;
    const result = parseSkillHeadings(markdown);
    expect(result).toEqual([
      { title: 'Ground it in the subject', subsections: [] },
      { title: 'Design principles', subsections: [] },
      { title: 'Process: brainstorm, explore, plan, critique, build, critique again', subsections: [] },
      { title: 'Restraint and self-critique', subsections: [] },
      { title: 'More on writing in design', subsections: [] },
    ]);
  });

  it('nests H3 lines under the preceding H2', () => {
    const markdown = `## 2. Craft Rules — How to Compose
### 2.1 Visual Hierarchy: The Three-Layer Rule
### 2.2 Font Discipline
## 3. Anti-Patterns — What to Never Do
`;
    const result = parseSkillHeadings(markdown);
    expect(result).toEqual([
      {
        title: '2. Craft Rules — How to Compose',
        subsections: ['2.1 Visual Hierarchy: The Three-Layer Rule', '2.2 Font Discipline'],
      },
      { title: '3. Anti-Patterns — What to Never Do', subsections: [] },
    ]);
  });

  it('returns an empty array for markdown with no ## headings', () => {
    const markdown = `# Just a title\nSome unstructured prose.\nMore prose.\n`;
    expect(parseSkillHeadings(markdown)).toEqual([]);
  });

  it('ignores an H3 that appears before any H2', () => {
    const markdown = `# Title\n### Orphan subsection\n## Real section\n### Real subsection\n`;
    const result = parseSkillHeadings(markdown);
    expect(result).toEqual([{ title: 'Real section', subsections: ['Real subsection'] }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/parseSkillHeadings.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/parseSkillHeadings'`

- [ ] **Step 3: Write the implementation**

```ts
export interface ContentSection {
  title: string;
  subsections: string[];
}

export function parseSkillHeadings(markdown: string): ContentSection[] {
  const sections: ContentSection[] = [];
  let current: ContentSection | null = null;

  for (const line of markdown.split('\n')) {
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      current = { title: h2[1].trim(), subsections: [] };
      sections.push(current);
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3 && current) {
      current.subsections.push(h3[1].trim());
    }
  }

  return sections;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/parseSkillHeadings.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parseSkillHeadings.ts tests/lib/parseSkillHeadings.test.ts
git commit -m "Add parseSkillHeadings for extracting SKILL.md's ##/### outline"
```

---

### Task 3: `groupFileTree` — partition a skill's file tree into root files + folders, hoisting SKILL.md's own folder

**Files:**
- Create: `src/lib/groupFileTree.ts`
- Test: `tests/lib/groupFileTree.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (independent pure function).
- Produces: `FileTreeEntry { path: string; type: 'file' | 'dir'; url: string }`, `FileTreeFolder { name: string; url: string; files: FileTreeEntry[] }`, `GroupedFileTree { rootFiles: FileTreeEntry[]; folders: FileTreeFolder[] }`, `groupFileTree(fileTree: FileTreeEntry[]): GroupedFileTree`.

This is the trickiest function in the feature. Read the spec's Component section ("Package branch") before touching this — it explains why `SKILL.md`'s containing folder has to be hoisted (its contents treated as the effective top level) rather than grouped literally, and why ancestor directories of that folder must be dropped entirely rather than surfacing as bogus empty folder rows.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { groupFileTree, type FileTreeEntry } from '../../src/lib/groupFileTree';

describe('groupFileTree', () => {
  it('handles a skill with SKILL.md at the scope root plus one sibling file', () => {
    // frontend-design: subtree sourceUrl, fileTree already scoped to skills/frontend-design/
    const fileTree: FileTreeEntry[] = [
      { path: 'SKILL.md', type: 'file', url: 'https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md' },
      { path: 'LICENSE.txt', type: 'file', url: 'https://github.com/anthropics/skills/blob/main/skills/frontend-design/LICENSE.txt' },
    ];
    expect(groupFileTree(fileTree)).toEqual({
      rootFiles: [{ path: 'LICENSE.txt', type: 'file', url: 'https://github.com/anthropics/skills/blob/main/skills/frontend-design/LICENSE.txt' }],
      folders: [],
    });
  });

  it('hoists a one-level-deep SKILL.md folder, keeping true-root siblings separate', () => {
    // nothing-design: repo-root sourceUrl, SKILL.md lives at nothing-design/SKILL.md
    const fileTree: FileTreeEntry[] = [
      { path: 'LICENSE', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/LICENSE' },
      { path: 'README.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/README.md' },
      { path: 'nothing-design', type: 'dir', url: 'https://github.com/dominikmartn/nothing-design-skill/tree/main/nothing-design' },
      { path: 'nothing-design/SKILL.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/SKILL.md' },
      { path: 'nothing-design/references', type: 'dir', url: 'https://github.com/dominikmartn/nothing-design-skill/tree/main/nothing-design/references' },
      { path: 'nothing-design/references/components.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/references/components.md' },
      { path: 'nothing-design/references/platform-mapping.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/references/platform-mapping.md' },
      { path: 'nothing-design/references/tokens.md', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/nothing-design/references/tokens.md' },
      { path: 'preview.gif', type: 'file', url: 'https://github.com/dominikmartn/nothing-design-skill/blob/main/preview.gif' },
    ];

    const result = groupFileTree(fileTree);

    expect(result.rootFiles.map((f) => f.path)).toEqual(['LICENSE', 'README.md', 'preview.gif']);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('references');
    expect(result.folders[0].files.map((f) => f.path)).toEqual([
      'components.md',
      'platform-mapping.md',
      'tokens.md',
    ]);
  });

  it('hoists a two-level-deep SKILL.md folder and drops intermediate ancestor directories', () => {
    // make-interfaces-feel-better: repo-root sourceUrl, SKILL.md lives at
    // skills/make-interfaces-feel-better/SKILL.md — "skills" is an ancestor
    // directory that must NOT surface as a bogus empty folder row.
    const base = 'https://github.com/jakubkrehel/make-interfaces-feel-better';
    const fileTree: FileTreeEntry[] = [
      { path: 'AGENTS.md', type: 'file', url: `${base}/blob/main/AGENTS.md` },
      { path: 'CLAUDE.md', type: 'file', url: `${base}/blob/main/CLAUDE.md` },
      { path: 'LICENSE', type: 'file', url: `${base}/blob/main/LICENSE` },
      { path: 'README.md', type: 'file', url: `${base}/blob/main/README.md` },
      { path: 'skills', type: 'dir', url: `${base}/tree/main/skills` },
      { path: 'skills/make-interfaces-feel-better', type: 'dir', url: `${base}/tree/main/skills/make-interfaces-feel-better` },
      { path: 'skills/make-interfaces-feel-better/SKILL.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/SKILL.md` },
      { path: 'skills/make-interfaces-feel-better/agents', type: 'dir', url: `${base}/tree/main/skills/make-interfaces-feel-better/agents` },
      { path: 'skills/make-interfaces-feel-better/agents/openai.yaml', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/agents/openai.yaml` },
      { path: 'skills/make-interfaces-feel-better/animations.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/animations.md` },
      { path: 'skills/make-interfaces-feel-better/icons.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/icons.md` },
      { path: 'skills/make-interfaces-feel-better/performance.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/performance.md` },
      { path: 'skills/make-interfaces-feel-better/surfaces.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/surfaces.md` },
      { path: 'skills/make-interfaces-feel-better/typography.md', type: 'file', url: `${base}/blob/main/skills/make-interfaces-feel-better/typography.md` },
    ];

    const result = groupFileTree(fileTree);

    expect(result.rootFiles.map((f) => f.path)).toEqual([
      'AGENTS.md',
      'CLAUDE.md',
      'LICENSE',
      'README.md',
      'animations.md',
      'icons.md',
      'performance.md',
      'surfaces.md',
      'typography.md',
    ]);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('agents');
    expect(result.folders[0].files.map((f) => f.path)).toEqual(['openai.yaml']);
  });

  it('returns empty rootFiles and folders when SKILL.md is the only entry', () => {
    // emil-design-eng: no files besides its own SKILL.md
    const fileTree: FileTreeEntry[] = [
      { path: 'SKILL.md', type: 'file', url: 'https://github.com/emilkowalski/skills/blob/main/skills/emil-design-eng/SKILL.md' },
    ];
    expect(groupFileTree(fileTree)).toEqual({ rootFiles: [], folders: [] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lib/groupFileTree.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/groupFileTree'`

- [ ] **Step 3: Write the implementation**

```ts
export interface FileTreeEntry {
  path: string;
  type: 'file' | 'dir';
  url: string;
}

export interface FileTreeFolder {
  name: string;
  url: string;
  files: FileTreeEntry[];
}

export interface GroupedFileTree {
  rootFiles: FileTreeEntry[];
  folders: FileTreeFolder[];
}

function basename(entryPath: string): string {
  const segments = entryPath.split('/');
  return segments[segments.length - 1];
}

function isAncestorOrSelf(candidatePath: string, hubDir: string): boolean {
  return candidatePath === hubDir || hubDir.startsWith(`${candidatePath}/`);
}

export function groupFileTree(fileTree: FileTreeEntry[]): GroupedFileTree {
  const hub = fileTree.find((entry) => basename(entry.path) === 'SKILL.md');
  const hubDir = hub ? hub.path.slice(0, hub.path.length - 'SKILL.md'.length).replace(/\/$/, '') : '';

  function relativize(entryPath: string): string {
    if (hubDir && entryPath.startsWith(`${hubDir}/`)) {
      return entryPath.slice(hubDir.length + 1);
    }
    return entryPath;
  }

  const normalized = fileTree
    .filter((entry) => entry !== hub)
    .filter((entry) => !(hubDir && entry.type === 'dir' && isAncestorOrSelf(entry.path, hubDir)))
    .map((entry) => ({ ...entry, relPath: relativize(entry.path) }));

  const rootFiles: FileTreeEntry[] = normalized
    .filter((entry) => entry.type === 'file' && !entry.relPath.includes('/'))
    .map((entry) => ({ path: entry.relPath, type: entry.type, url: entry.url }));

  const dirEntries = normalized.filter((entry) => entry.type === 'dir' && !entry.relPath.includes('/'));

  const folders: FileTreeFolder[] = dirEntries.map((dir) => {
    const prefix = `${dir.relPath}/`;
    const files: FileTreeEntry[] = normalized
      .filter(
        (entry) =>
          entry.type === 'file' &&
          entry.relPath.startsWith(prefix) &&
          !entry.relPath.slice(prefix.length).includes('/')
      )
      .map((entry) => ({ path: entry.relPath.slice(prefix.length), type: entry.type, url: entry.url }));
    return { name: dir.relPath, url: dir.url, files };
  });

  return { rootFiles, folders };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lib/groupFileTree.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/groupFileTree.ts tests/lib/groupFileTree.test.ts
git commit -m "Add groupFileTree, hoisting SKILL.md's own folder into the top level"
```

---

### Task 4: Fetch script — backfill real `fileTree`/`contentOutline` data into all 11 skills

**Files:**
- Create: `scripts/fetch-skill-trees.ts`
- Modify (by running the script, not by hand): all 11 files in `src/content/skills/*.mdx`

**Interfaces:**
- Consumes: `parseSourceUrl` (Task 1), `parseSkillHeadings` (Task 2), `FileTreeEntry` type (Task 3).
- Produces: every skill `.mdx` file's frontmatter gains `fileTree: FileTreeEntry[]` and `contentOutline: ContentSection[]`.

This task has no unit tests — it's a one-time operational script that calls the real GitHub API via `gh`, matching the spec's stated testing approach ("no build-time fallback needed since it never runs during `astro build`"). Its correctness is verified by actually running it and inspecting the result, and later locked in by Task 5's schema + corpus test.

- [ ] **Step 1: Write the script**

```ts
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parseSourceUrl } from '../src/lib/parseSourceUrl';
import { parseSkillHeadings } from '../src/lib/parseSkillHeadings';
import type { FileTreeEntry } from '../src/lib/groupFileTree';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function gh(args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 20 });
}

function ghApi(endpoint: string, jq?: string): string {
  const args = ['api', endpoint];
  if (jq) args.push('--jq', jq);
  return gh(args).trim();
}

interface GithubTreeEntry {
  path: string;
  type: 'blob' | 'tree';
}

function buildFileTree(owner: string, repo: string, branch: string, scopePath: string): FileTreeEntry[] {
  const raw = ghApi(`repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  const parsed = JSON.parse(raw) as { tree: GithubTreeEntry[] };
  const prefix = scopePath ? `${scopePath}/` : '';

  return parsed.tree
    .filter((entry) => (prefix ? entry.path.startsWith(prefix) : true))
    .map((entry) => {
      const relativePath = prefix ? entry.path.slice(prefix.length) : entry.path;
      const type: 'file' | 'dir' = entry.type === 'tree' ? 'dir' : 'file';
      const urlKind = type === 'dir' ? 'tree' : 'blob';
      return {
        path: relativePath,
        type,
        url: `https://github.com/${owner}/${repo}/${urlKind}/${branch}/${entry.path}`,
      };
    })
    .filter((entry) => entry.path !== '');
}

function fetchFileContent(owner: string, repo: string, repoPath: string): string {
  const base64 = ghApi(`repos/${owner}/${repo}/contents/${repoPath}`, '.content');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

const skillsDir = path.join(__dirname, '../src/content/skills');
const files = readdirSync(skillsDir).filter((f) => f.endsWith('.mdx'));

for (const file of files) {
  const filePath = path.join(skillsDir, file);
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const sourceUrl = parsed.data.sourceUrl as string;

  const { owner, repo, path: scopePath } = parseSourceUrl(sourceUrl);
  const branch = ghApi(`repos/${owner}/${repo}`, '.default_branch');

  const fileTree = buildFileTree(owner, repo, branch, scopePath);

  const hubEntry = fileTree.find((entry) => entry.path.split('/').pop() === 'SKILL.md');
  if (!hubEntry) {
    throw new Error(`${file}: no SKILL.md found under scope "${scopePath}" in ${owner}/${repo}`);
  }
  const skillMdRepoPath = scopePath ? `${scopePath}/${hubEntry.path}` : hubEntry.path;
  const skillMdContent = fetchFileContent(owner, repo, skillMdRepoPath);
  const contentOutline = parseSkillHeadings(skillMdContent);

  parsed.data.fileTree = fileTree;
  parsed.data.contentOutline = contentOutline;

  const output = matter.stringify(parsed.content, parsed.data);
  writeFileSync(filePath, output);
  console.log(`✓ ${file}: ${fileTree.length} fileTree entries, ${contentOutline.length} content sections`);
}
```

- [ ] **Step 2: Run it for real**

Run: `npx tsx scripts/fetch-skill-trees.ts`
Expected: 11 lines of `✓ <file>: N fileTree entries, M content sections` output, one per skill, no errors. (`npx` will prompt to install `tsx` on first run — accept it.)

- [ ] **Step 3: Spot-check the output**

Run: `git diff src/content/skills/frontend-design.mdx src/content/skills/nothing-design.mdx src/content/skills/emil-design-eng.mdx`

Confirm for each:
- Every pre-existing frontmatter field (`name`, `tagline`, `sourceUrl`, etc.) and the MDX body are unchanged — only `fileTree` and `contentOutline` were added.
- `frontend-design.mdx`: `fileTree` has exactly 2 entries (`SKILL.md`, `LICENSE.txt`); `contentOutline` has 5 sections, all with empty `subsections`.
- `nothing-design.mdx`: `fileTree` includes the nested `nothing-design/SKILL.md` and `nothing-design/references/*.md` paths; `contentOutline` has 5 sections, the "Craft Rules" one with 9 subsections.
- `emil-design-eng.mdx`: `fileTree` has exactly 1 entry (`skills/emil-design-eng/SKILL.md`... actually scoped, so just `SKILL.md`); `contentOutline` has 15 sections.

If any of these don't match, fix the script and re-run before moving on — don't proceed to Task 5 with bad backfilled data.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-skill-trees.ts src/content/skills/*.mdx
git commit -m "Backfill fileTree and contentOutline into all 11 skill entries"
```

---

### Task 5: Tighten the schema and extend the corpus test

**Files:**
- Modify: `src/content/skillSchema.ts`
- Modify: `tests/content/skillSchema.test.ts`
- Modify: `tests/content/mdxCorpus.test.ts`

**Interfaces:**
- Consumes: the real `fileTree`/`contentOutline` data backfilled in Task 4.
- Produces: `skillSchema` now validates `fileTree` (required, non-empty) and `contentOutline` (defaults to `[]`); `Skill['fileTree']` and `Skill['contentOutline']` types available to page/component code via `CollectionEntry<'skills'>['data']`.

This task is safe to run now specifically because Task 4 already ran — every `.mdx` file already has real `fileTree`/`contentOutline` data, so making the field required doesn't break anything. If this task ran before Task 4, `astro check` and the corpus test would fail for all 11 skills until the backfill existed.

- [ ] **Step 1: Add the new schema fields**

In `src/content/skillSchema.ts`, add above `skillSchema`:

```ts
const fileTreeEntrySchema = z.object({
  path: z.string(),
  type: z.enum(['file', 'dir']),
  url: z.string().url(),
});

const contentSectionSchema = z.object({
  title: z.string(),
  subsections: z.array(z.string()).default([]),
});
```

And inside `skillSchema`'s `z.object({...})`, add:

```ts
  fileTree: z.array(fileTreeEntrySchema).min(1),
  contentOutline: z.array(contentSectionSchema).default([]),
```

- [ ] **Step 2: Update the schema unit test's fixture and add coverage for the new fields**

In `tests/content/skillSchema.test.ts`, add `fileTree`/`contentOutline` to `validSkill`:

```ts
const validSkill = {
  slug: 'frontend-design',
  name: 'Frontend Design',
  tagline: 'A tagline.',
  sourceUrl: 'https://github.com/anthropics/skills',
  sourceAuthor: 'Anthropic',
  tools: ['claude'],
  categories: ['ui-aesthetics'],
  previewType: 'image',
  previewAssets: ['/previews/frontend-design.svg'],
  rating: 5,
  addedDate: '2026-07-01',
  lastVerified: '2026-07-29',
  status: 'active',
  featured: true,
  fileTree: [{ path: 'SKILL.md', type: 'file', url: 'https://github.com/anthropics/skills/blob/main/SKILL.md' }],
  contentOutline: [{ title: 'A section', subsections: [] }],
};
```

Add these tests to the `describe('skillSchema', ...)` block:

```ts
  it('defaults contentOutline to an empty array when omitted', () => {
    const { contentOutline, ...rest } = validSkill;
    const result = skillSchema.parse(rest);
    expect(result.contentOutline).toEqual([]);
  });

  it('rejects an empty fileTree', () => {
    expect(() => skillSchema.parse({ ...validSkill, fileTree: [] })).toThrow();
  });

  it('rejects a fileTree entry with an invalid type', () => {
    const badTree = [{ path: 'SKILL.md', type: 'symlink', url: 'https://github.com/x/y/blob/main/SKILL.md' }];
    expect(() => skillSchema.parse({ ...validSkill, fileTree: badTree })).toThrow();
  });

  it('rejects a fileTree entry with a non-URL url field', () => {
    const badTree = [{ path: 'SKILL.md', type: 'file', url: 'not-a-url' }];
    expect(() => skillSchema.parse({ ...validSkill, fileTree: badTree })).toThrow();
  });
```

- [ ] **Step 3: Extend the corpus test to check the SKILL.md invariant across all real files**

In `tests/content/mdxCorpus.test.ts`, add inside the `for (const file of files)` loop, alongside the existing per-file `it(...)` blocks:

```ts
    it(`${file}'s fileTree has exactly one SKILL.md entry`, () => {
      const raw = readFileSync(path.join(skillsDir, file), 'utf-8');
      const { data } = matter(raw);
      const parsed = skillSchema.parse(data);
      const skillMdEntries = parsed.fileTree.filter((entry) => entry.path.split('/').pop() === 'SKILL.md');
      expect(skillMdEntries, `${file} should have exactly one SKILL.md entry in fileTree`).toHaveLength(1);
    });
```

- [ ] **Step 4: Run everything and verify it's all green**

Run: `npx vitest run`
Expected: PASS — all existing tests plus the new ones (schema tests, corpus test's new per-file assertion × 11).

Run: `npx astro check`
Expected: 0 errors, 0 warnings.

Run: `npm run build`
Expected: build succeeds, all 15 pages generated.

- [ ] **Step 5: Commit**

```bash
git add src/content/skillSchema.ts tests/content/skillSchema.test.ts tests/content/mdxCorpus.test.ts
git commit -m "Require fileTree and default contentOutline on skillSchema"
```

---

### Task 6: `StructureMap.astro` component

**Files:**
- Create: `src/components/StructureMap.astro`

**Interfaces:**
- Consumes: `groupFileTree` (Task 3), `FileTreeEntry`/`FileTreeFolder` types (Task 3), `ContentSection` type (Task 2).
- Produces: `<StructureMap name tagline fileTree contentOutline />`, self-contained (renders its own `<section>` including heading — the consuming page does not need to add its own wrapper or heading).

- [ ] **Step 1: Write the component**

```astro
---
import { groupFileTree, type FileTreeEntry } from '../lib/groupFileTree';
import type { ContentSection } from '../lib/parseSkillHeadings';

interface Props {
  name: string;
  tagline: string;
  fileTree: FileTreeEntry[];
  contentOutline: ContentSection[];
}

const { name, tagline, fileTree, contentOutline } = Astro.props;
const { rootFiles, folders } = groupFileTree(fileTree);
const hasContents = contentOutline.length > 0;
const hasPackage = rootFiles.length > 0 || folders.length > 0;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
---

{(hasContents || hasPackage) && (
  <section class="structure-map">
    <p class="mb-4 text-xs font-semibold text-ink-soft">File &amp; content map</p>

    <div class="diagram">
      <div class="hub">
        <span class="hub-file font-mono">SKILL.md</span>
        <p class="hub-name">{name}</p>
        <p class="hub-tagline">{tagline}</p>
      </div>

      <div class="branches">
        {hasContents && (
          <div class="branch">
            <p class="branch-label">Contents — {plural(contentOutline.length, 'section')}</p>
            <div class="tree">
              {contentOutline.map((section) => (
                <div class="node">
                  <div class="node-row">
                    <span class="glyph section"></span>
                    <span class="node-label">{section.title}</span>
                    {section.subsections.length > 0 && (
                      <>
                        <span class="node-meta font-mono">{plural(section.subsections.length, 'sub')}</span>
                        <span class="hint-badge">hover</span>
                      </>
                    )}
                  </div>
                  {section.subsections.length > 0 && (
                    <div class="children">
                      {section.subsections.slice(0, 4).map((sub) => (
                        <div class="child-row">
                          <span class="glyph section child-glyph"></span>
                          <span class="child-label">{sub}</span>
                        </div>
                      ))}
                      {section.subsections.length > 4 && (
                        <div class="more">+ {section.subsections.length - 4} more</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasPackage && (
          <div class="branch">
            <p class="branch-label">
              Package — {plural(rootFiles.length, 'file')}
              {folders.length > 0 && `, ${plural(folders.length, 'folder')}`}
            </p>
            <div class="tree">
              {rootFiles.map((file) => (
                <div class="node">
                  <div class="node-row">
                    <span class="glyph file"></span>
                    <a class="node-label" href={file.url} target="_blank" rel="noopener">{file.path}</a>
                  </div>
                </div>
              ))}
              {folders.map((folder) => (
                <div class="node">
                  <div class="node-row">
                    <span class="glyph dir"></span>
                    <a class="node-label" href={folder.url} target="_blank" rel="noopener">{folder.name}/</a>
                    {folder.files.length > 0 && (
                      <>
                        <span class="node-meta font-mono">{plural(folder.files.length, 'file')}</span>
                        <span class="hint-badge">hover</span>
                      </>
                    )}
                  </div>
                  {folder.files.length > 0 && (
                    <div class="children">
                      {folder.files.slice(0, 3).map((f) => (
                        <div class="child-row">
                          <span class="glyph file child-glyph"></span>
                          <a class="child-label" href={f.url} target="_blank" rel="noopener">{f.path}</a>
                        </div>
                      ))}
                      {folder.files.length > 3 && (
                        <div class="more">+ {folder.files.length - 3} more</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>

    <div class="legend">
      <span class="legend-item"><span class="glyph section"></span> content section</span>
      <span class="legend-item"><span class="glyph file"></span> file</span>
      <span class="legend-item"><span class="glyph dir"></span> folder</span>
    </div>
  </section>
)}

<style>
  .structure-map {
    margin-top: 2.5rem;
  }

  .diagram {
    display: grid;
    grid-template-columns: minmax(180px, 220px) 1fr;
    gap: 0 1.75rem;
    align-items: start;
  }

  .hub {
    background: var(--color-accent-orange);
    color: white;
    padding: 1.25rem 1.125rem;
    border-radius: 3px;
  }

  .hub-file {
    display: block;
    font-size: 0.9375rem;
    margin-bottom: 0.5rem;
  }

  .hub-name {
    font-size: 1.0625rem;
    font-weight: 900;
    line-height: 1.2;
    margin: 0 0 0.375rem;
  }

  .hub-tagline {
    font-size: 0.75rem;
    line-height: 1.5;
    color: rgba(255, 255, 255, 0.82);
    margin: 0;
  }

  .branches {
    display: flex;
    flex-direction: column;
    gap: 1.375rem;
  }

  .branch-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-ink-soft);
    margin: 0 0 0.625rem;
  }

  .tree {
    border-left: 1px solid var(--color-rule);
    margin-left: 3px;
  }

  .node {
    position: relative;
    padding: 0.4375rem 0.25rem;
    margin: 0 -0.25rem;
    border-radius: 3px;
    transition: background-color 0.18s ease;
  }

  .node:hover {
    background-color: color-mix(in oklch, var(--color-accent-orange) 8%, transparent);
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .node-row::before {
    content: "";
    flex: none;
    width: 14px;
    height: 1px;
    background: var(--color-rule);
    transition: background-color 0.18s ease;
  }

  .node:hover .node-row::before {
    background: var(--color-rule-strong);
  }

  .glyph {
    flex: none;
    width: 8px;
    height: 8px;
    border: 1.3px solid var(--color-ink-soft);
    transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .node:hover .glyph {
    transform: scale(1.25);
  }

  .glyph.section {
    border-radius: 50%;
    border-color: var(--color-accent-orange);
    background: var(--color-accent-orange);
  }

  .glyph.file {
    background: var(--color-ink-soft);
  }

  .glyph.dir {
    background: transparent;
  }

  .child-glyph {
    width: 6px;
    height: 6px;
  }

  .node-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-ink);
  }

  a.node-label {
    text-decoration: none;
    border-bottom: 1px solid var(--color-rule-strong);
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  a.node-label:hover {
    color: var(--color-accent-orange);
    border-color: var(--color-accent-orange);
  }

  .node-meta {
    font-size: 0.65625rem;
    color: var(--color-ink-soft);
    background: color-mix(in oklch, var(--color-accent-orange) 8%, transparent);
    padding: 1px 6px;
    border-radius: 20px;
  }

  .hint-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.59375rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-accent-orange);
    margin-left: auto;
  }

  .children {
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
    border-left: 1px solid var(--color-rule);
    margin: 0.375rem 0 0 3px;
  }

  .node:hover .children {
    max-height: 400px;
    opacity: 1;
  }

  .child-row {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.25rem;
    margin: 0 -0.25rem;
    border-radius: 3px;
    transition: background-color 0.15s ease;
  }

  .child-row:hover {
    background-color: color-mix(in oklch, var(--color-accent-orange) 8%, transparent);
  }

  .child-row::before {
    content: "";
    flex: none;
    width: 12px;
    height: 1px;
    background: var(--color-rule);
  }

  .child-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-ink-soft);
  }

  a.child-label {
    text-decoration: none;
    transition: color 0.15s ease;
  }

  a.child-label:hover {
    color: var(--color-accent-orange);
  }

  .more {
    font-size: 0.6875rem;
    color: var(--color-ink-soft);
    padding: 0.25rem 0 0.25rem 1.1875rem;
  }

  .legend {
    margin-top: 1.75rem;
    padding: 0.875rem 1.125rem;
    border: 1px solid var(--color-rule);
    display: inline-flex;
    gap: 1.375rem;
    flex-wrap: wrap;
    background: var(--color-paper);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    font-size: 0.6875rem;
    color: var(--color-ink-soft);
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .diagram {
      grid-template-columns: 1fr;
    }
    .branches {
      margin-top: 1.125rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .children,
    .node,
    .node-row::before,
    .glyph,
    .child-row,
    a.node-label,
    a.child-label {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Type-check**

Run: `npx astro check`
Expected: 0 errors, 0 warnings. (The component isn't referenced anywhere yet, so this just confirms it compiles standalone.)

- [ ] **Step 3: Commit**

```bash
git add src/components/StructureMap.astro
git commit -m "Add StructureMap.astro: hub-and-branch file/content diagram"
```

---

### Task 7: Wire `StructureMap` into the skill detail page and verify visually

**Files:**
- Modify: `src/pages/skills/[slug].astro`

**Interfaces:**
- Consumes: `StructureMap` (Task 6), `entry.data.fileTree`/`entry.data.contentOutline` (Task 5).

- [ ] **Step 1: Import the component and destructure the new fields**

In `src/pages/skills/[slug].astro`, change:

```astro
import { CATEGORY_META } from '../../lib/categoryMeta';
import { TOOL_META } from '../../lib/toolMeta';
import { TOOL_VALUES } from '../../content/skillSchema';
```

to:

```astro
import { CATEGORY_META } from '../../lib/categoryMeta';
import { TOOL_META } from '../../lib/toolMeta';
import { TOOL_VALUES } from '../../content/skillSchema';
import StructureMap from '../../components/StructureMap.astro';
```

and change:

```astro
const {
  name,
  tagline,
  tools,
  categories,
  rating,
  sourceUrl,
  sourceAuthor,
  lastVerified,
  status,
} = entry.data;
```

to:

```astro
const {
  name,
  tagline,
  tools,
  categories,
  rating,
  sourceUrl,
  sourceAuthor,
  lastVerified,
  status,
  fileTree,
  contentOutline,
} = entry.data;
```

- [ ] **Step 2: Render the component after the two-column grid**

Find the closing of the two-column grid:

```astro
  <div class="grid grid-cols-1 gap-12 lg:grid-cols-[2fr_1fr]">
    ...
  </div>
</BaseLayout>
```

Change to:

```astro
  <div class="grid grid-cols-1 gap-12 lg:grid-cols-[2fr_1fr]">
    ...
  </div>

  <StructureMap name={name} tagline={tagline} fileTree={fileTree} contentOutline={contentOutline} />
</BaseLayout>
```

- [ ] **Step 3: Type-check and build**

Run: `npx astro check`
Expected: 0 errors, 0 warnings.

Run: `npm run build`
Expected: build succeeds, all pages generated including all 11 skill detail pages.

- [ ] **Step 4: Visual verification in the Browser pane**

Start (or reuse) the dev server preview, then for each of the three cases named in the spec's Testing section, navigate to the page and confirm:

- `http://localhost:4321/skills/frontend-design/` — both branches present and small (5 flat content sections, 1 file); the orange hero above is unaffected by this change; hovering a row with no children does nothing extra (no empty expand).
- `http://localhost:4321/skills/nothing-design/` — hover "2. Craft Rules — How to Compose" and confirm its 9 subsections expand (4 shown + "+ 5 more"); hover "references/" and confirm its 3 files expand; confirm root files show `LICENSE`, `README.md`, `preview.gif` (not `nothing-design/LICENSE` or similar).
- `http://localhost:4321/skills/emil-design-eng/` — confirm only the Contents branch renders (15 sections, "Component Building Principles" hover-expands to 4 + "+ 3 more"); confirm there's no empty "Package" label or empty folder row — the branch is fully absent, not just visually empty.

If anything doesn't match, read the relevant source (most likely `groupFileTree.ts` or the component template), fix it, re-run Step 3, and re-check.

- [ ] **Step 5: Commit**

```bash
git add src/pages/skills/[slug].astro
git commit -m "Wire StructureMap into the skill detail page"
```
