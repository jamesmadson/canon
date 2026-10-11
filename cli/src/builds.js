/**
 * Which prototypes to build for the hosted gallery, and how.
 *
 * The config holds a person's choices: which branches are prototypes, and for
 * each one the command that builds it and the folder the build lands in. This
 * turns those choices into a plan the deploy workflow can follow, one
 * prototype per URL segment. A selected prototype that cannot be built is
 * named as a problem, never dropped quietly, so a missing page has a reason.
 */

import { isAbsolute, normalize } from 'node:path';

/** One URL-safe path segment for a branch name. */
export function branchSlug(branch) {
  const slug = String(branch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'prototype';
}

function checkBuild(build) {
  const command = typeof build?.command === 'string' ? build.command.trim() : '';
  const outputDir = typeof build?.outputDir === 'string' ? build.outputDir.trim() : '';
  if (!command) return { problem: 'command is missing' };
  if (!outputDir) return { problem: 'outputDir is missing' };
  const normal = normalize(outputDir);
  if (isAbsolute(outputDir) || normal === '..' || normal.startsWith('../')) {
    return { problem: 'outputDir must stay inside the repository' };
  }
  return { command, outputDir: normal.replace(/\/+$/, '') };
}

export function buildPlan(config) {
  const selected = config.prototypes ?? [];
  const configured = config.builds ?? {};
  const builds = [];
  const problems = [];
  const taken = new Set();

  for (const branch of selected) {
    if (!Object.hasOwn(configured, branch)) {
      problems.push({ branch, problem: 'no build configured' });
      continue;
    }
    const checked = checkBuild(configured[branch]);
    if (checked.problem) {
      problems.push({ branch, problem: checked.problem });
      continue;
    }
    const base = branchSlug(branch);
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    taken.add(slug);
    builds.push({ branch, slug, command: checked.command, outputDir: checked.outputDir });
  }

  return { builds, problems };
}
