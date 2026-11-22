// Prints the notes for one version from CHANGELOG.md.
// Usage: node scripts/release-notes.mjs 0.1.1
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function notesFor(changelog, version) {
  const lines = changelog.split('\n');
  // A heading is "## <version>", alone or followed by " · date". "## 0.1.10" is not "## 0.1.1".
  const isHeading = (line) => line.startsWith('## ');
  const start = lines.findIndex((line) => line === `## ${version}` || line.startsWith(`## ${version} `));
  const missing = new Error(`CHANGELOG.md has no "## ${version}" section. Add one before tagging.`);
  if (start === -1) throw missing;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(isHeading);
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  if (!body) throw missing;
  return body;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const changelogPath = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));
    console.log(notesFor(readFileSync(changelogPath, 'utf8'), process.argv[2] ?? ''));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
