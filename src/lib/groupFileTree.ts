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
