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
