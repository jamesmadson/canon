import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INSTALL_COMMAND,
  INSTALL_UNPUBLISHED_NOTE,
  PACKAGE_PUBLISHED,
  installState,
  SIGNUP_CLOSED_NOTE,
  SIGNUP_ENDPOINT,
  signupState,
} from '../../src/lib/install';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SRC = join(ROOT, 'src');
const INSTALL_MODULE = join(SRC, 'lib', 'install.ts');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Everything a person might read the package name out of. The .md content under
// src/content is kit and skill prose about other people's skills, so it is not
// in scope; the site's own source is.
const SOURCE_FILES = walk(SRC).filter((file) => /\.(astro|ts|tsx|js|mjs)$/.test(file));

describe('the install command', () => {
  it('is one line a person can paste', () => {
    expect(INSTALL_COMMAND).toMatch(/^npx \S+ init$/);
  });

  it('is the only place the package name is written down', () => {
    // The distinguishing part of the command, which is the part that would go
    // stale if a second file repeated it.
    const packageName = INSTALL_COMMAND.split(' ')[1];
    expect(packageName).not.toBe('');

    const offenders = SOURCE_FILES.filter(
      (file) => file !== INSTALL_MODULE && readFileSync(file, 'utf8').includes(packageName)
    ).map((file) => file.slice(ROOT.length));

    expect(offenders).toEqual([]);
  });

  it('is not repeated as a whole command anywhere else either', () => {
    const offenders = SOURCE_FILES.filter(
      (file) => file !== INSTALL_MODULE && readFileSync(file, 'utf8').includes(INSTALL_COMMAND)
    ).map((file) => file.slice(ROOT.length));

    expect(offenders).toEqual([]);
  });
});

describe('the install line before the package is published', () => {
  it('cannot be copied while the package is not on npm', () => {
    const state = installState(false);
    expect(state.copyable).toBe(false);
    expect(state.copyable === false && state.reason).toBe(INSTALL_UNPUBLISHED_NOTE);
  });

  it('can be copied once it is', () => {
    expect(installState(true)).toEqual({ copyable: true });
  });

  it('ships uncopyable, because the package is not published yet', () => {
    expect(PACKAGE_PUBLISHED).toBe(false);
    expect(installState().copyable).toBe(false);
  });

  it('states the reason in the house voice', () => {
    expect(INSTALL_UNPUBLISHED_NOTE.trim().length).toBeGreaterThan(0);
    expect(INSTALL_UNPUBLISHED_NOTE).not.toMatch(/[\u2014\u2013\u0021]/);
  });

  it('gates the copy button on that state', () => {
    const block = readFileSync(join(SRC, 'components', 'InstallBlock.astro'), 'utf8');
    expect(block).toMatch(/disabled=\{!copyable\}/);
  });
});

describe('the alpha sign-up', () => {
  it('is closed while no endpoint is set', () => {
    const state = signupState('');
    expect(state.open).toBe(false);
    expect(state.open === false && state.reason).toBe(SIGNUP_CLOSED_NOTE);
  });

  it('treats whitespace as no endpoint rather than as a URL', () => {
    expect(signupState('   ').open).toBe(false);
  });

  it('opens and posts to the endpoint once one is set', () => {
    const state = signupState('https://example.test/alpha');
    expect(state.open).toBe(true);
    expect(state.open === true && state.action).toBe('https://example.test/alpha');
  });

  it('ships closed, so nothing on the site takes an address today', () => {
    expect(SIGNUP_ENDPOINT).toBe('');
    expect(signupState().open).toBe(false);
  });

  it('states the reason rather than leaving the button unexplained', () => {
    expect(SIGNUP_CLOSED_NOTE.trim().length).toBeGreaterThan(0);
    expect(SIGNUP_CLOSED_NOTE).not.toMatch(/[\u2014\u2013\u0021]/);
  });

  it('disables the field and the button whenever it is closed', () => {
    const form = readFileSync(join(SRC, 'components', 'SignupForm.astro'), 'utf8');
    // Two controls, both gated on the same state.
    expect(form.match(/disabled=\{!open\}/g)?.length).toBe(2);
    // The only submit handler hangs off the open marker, which a closed form
    // never renders, so nothing can accept an address behind disabled controls.
    expect(form).toMatch(/querySelector<HTMLFormElement>\('form\[data-signup-open\]'\)/);
    expect(form).toMatch(/data-signup-open=\{open \? '' : undefined\}/);
  });
});
