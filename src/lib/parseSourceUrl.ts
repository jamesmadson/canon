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
