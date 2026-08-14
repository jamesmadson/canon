export interface CanonAllKit {
  slug: string;
  title: string;
  body: string;
}

export interface CanonAllInput {
  routerBody: string;
  kits: CanonAllKit[];
}

const FRONTMATTER = `---
name: canon-all
description: >-
  Canon's three build kits in one file: marketing and landing sites,
  product UI and dashboards, and mobile review. Routes by task, then
  applies that kit's guidance — brand discipline, craft floor, motion
  frequency gate, copy rules, accessibility floor, and pre-ship gates.
  Use when designing, building, or reviewing any interface and you want
  Canon's judgment; say which kind of work it is, or ask which applies.
compatibility: >-
  Self-contained: needs no sibling skills installed. Built for surfaces
  that accept a single Markdown skill file, such as Figma Make and the
  Figma agent.
metadata:
  source: https://jamesmadson.github.io/canon/kits/
  generated: scripts/build-canon-artifacts.ts
---
`;

export function buildCanonAll(input: CanonAllInput): string {
  const sections = input.kits
    .map((kit) => `---\n\n# ${kit.title}\n\n${kit.body.trim()}\n`)
    .join('\n');

  return `${FRONTMATTER}\n${input.routerBody.trim()}\n\n${sections}`;
}
