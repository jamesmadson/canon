// Checks that a release tag is "v" plus the version in cli/package.json.
// Usage: node scripts/release-version.mjs v0.1.1
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function matchTag(tag, version) {
  if (tag !== `v${version}`) {
    throw new Error(
      `Tag ${tag} does not match cli/package.json version ${version}. Bump the package version or retag.`,
    );
  }
  return version;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const packagePath = fileURLToPath(new URL('../cli/package.json', import.meta.url));
    const { version } = JSON.parse(readFileSync(packagePath, 'utf8'));
    console.log(matchTag(process.argv[2] ?? '', version));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
