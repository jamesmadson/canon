import { unzip } from 'fflate';
import { isZipName, mimeFor, nameFromFile, pickEntry, stripCommonRoot, titleFromHtml } from './lib/ingest';

export interface RawFile { path: string; blob: Blob }
export interface Group { name: string; files: RawFile[]; handle?: FileSystemDirectoryHandle }
export interface Prepared { name: string; entry: string; files: { path: string; blob: Blob; type: string }[]; handle?: FileSystemDirectoryHandle }

function unzipBlob(blob: Blob): Promise<RawFile[]> {
  return blob.arrayBuffer().then(
    (buf) =>
      new Promise((resolve, reject) => {
        unzip(new Uint8Array(buf), (err, out) => {
          if (err) return reject(err);
          resolve(
            Object.entries(out)
              .filter(([path]) => !path.endsWith('/'))
              .map(([path, data]) => ({ path, blob: new Blob([data]) }))
          );
        });
      })
  );
}

function readEntry(entry: FileSystemEntry, prefix = ''): Promise<RawFile[]> {
  if (entry.isFile) {
    return new Promise((resolve) =>
      (entry as FileSystemFileEntry).file(
        (file) => resolve([{ path: prefix + file.name, blob: file }]),
        () => resolve([])
      )
    );
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries(async (batch) => {
        if (batch.length) {
          all.push(...batch);
          next();
        } else {
          const nested = await Promise.all(all.map((e) => readEntry(e, `${prefix}${entry.name}/`)));
          resolve(nested.flat());
        }
      }, () => resolve([]));
    next();
  });
}

async function fileToGroups(file: File): Promise<Group[]> {
  if (isZipName(file.name)) return [{ name: nameFromFile(file.name), files: await unzipBlob(file) }];
  if (/\.html?$/i.test(file.name)) return [{ name: nameFromFile(file.name), files: [{ path: file.name, blob: file }] }];
  return [];
}

/** Everything in a drop, as one group per prototype. Loose non-HTML files are skipped. */
export async function groupsFromDrop(dt: DataTransfer): Promise<{ groups: Group[]; skipped: number }> {
  const groups: Group[] = [];
  let skipped = 0;
  const items = Array.from(dt.items).filter((i) => i.kind === 'file');
  const entries = items.map((i) => i.webkitGetAsEntry?.() ?? null);
  const files = items.map((i) => i.getAsFile());
  for (let k = 0; k < items.length; k++) {
    const entry = entries[k];
    if (entry?.isDirectory) {
      groups.push({ name: entry.name, files: await readEntry(entry) });
    } else if (files[k]) {
      const g = await fileToGroups(files[k]!);
      if (g.length) groups.push(...g);
      else skipped++;
    }
  }
  return { groups, skipped };
}

export async function groupsFromFiles(list: FileList): Promise<{ groups: Group[]; skipped: number }> {
  const files = Array.from(list);
  // A folder picked with webkitdirectory arrives as one flat list with relative paths.
  if (files.length && files[0].webkitRelativePath) {
    return { groups: [{ name: files[0].webkitRelativePath.split('/')[0], files: files.map((f) => ({ path: f.webkitRelativePath, blob: f })) }], skipped: 0 };
  }
  const groups: Group[] = [];
  let skipped = 0;
  for (const f of files) {
    const g = await fileToGroups(f);
    if (g.length) groups.push(...g);
    else skipped++;
  }
  return { groups, skipped };
}

export const canLinkFolders = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function walkHandle(dir: FileSystemDirectoryHandle, prefix = ''): Promise<RawFile[]> {
  const out: RawFile[] = [];
  for await (const handle of dir.values()) {
    if (handle.name === 'node_modules' || handle.name === '.git') continue;
    if (handle.kind === 'file') out.push({ path: prefix + handle.name, blob: await (handle as FileSystemFileHandle).getFile() });
    else out.push(...(await walkHandle(handle as FileSystemDirectoryHandle, `${prefix}${handle.name}/`)));
  }
  return out;
}

export async function linkFolder(): Promise<Group | null> {
  try {
    // @ts-expect-error: Chromium only
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'read' });
    return { name: handle.name, files: await walkHandle(handle), handle };
  } catch {
    return null;
  }
}

export async function prepare(group: Group): Promise<Prepared | null> {
  const stripped = stripCommonRoot(group.files.map((f) => f.path));
  const files = group.files
    .map((f, i) => ({ path: stripped[i], blob: f.blob }))
    .filter((f) => !f.path.startsWith('__MACOSX/'))
    .map((f) => ({ ...f, type: mimeFor(f.path) }));
  const entry = pickEntry(files.map((f) => f.path));
  if (!entry) return null;
  const html = await files.find((f) => f.path === entry)!.blob.text();
  return { name: titleFromHtml(html) ?? group.name, entry, files, handle: group.handle };
}
