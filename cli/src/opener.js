/**
 * Handing a finished file to the platform.
 *
 * The one thing this tool does that is not reading or writing a file in the
 * repository, kept in its own module so it is easy to see that it is the only
 * one. It launches the platform viewer and nothing else.
 */

import { spawn } from 'node:child_process';

/** The viewer for a platform, or null where there is no obvious one. */
export function openerFor(platform) {
  if (platform === 'darwin') return { command: 'open', args: [] };
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', ''] };
  return { command: 'xdg-open', args: [] };
}

/**
 * Opens a path with the platform viewer. Detached so the terminal comes back
 * straight away, and quiet on failure: a viewer that will not launch is not a
 * reason to fail a render that already succeeded.
 */
export function openFile(path, platform = process.platform) {
  const { command, args } = openerFor(platform);
  try {
    const child = spawn(command, [...args, path], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
