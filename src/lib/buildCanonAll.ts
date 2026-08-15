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

/**
 * Demotes every ATX heading (`#` … `######`) by one level, so a body that
 * assumed it owned the top of the document nests correctly under a wrapper
 * heading instead. Only touches heading lines outside fenced code blocks —
 * lines inside ``` or ~~~ fences are passed through untouched, so a fenced
 * shell comment like `# build it` never gets rewritten. Inline code spans
 * (`` `# not a heading` ``) are unaffected by construction: ATX headings are
 * only recognized at the start of a line, and a code span's backtick can't
 * open a line-anchored match unless the whole line degenerately is one.
 */
export function demoteHeadings(markdown: string): string {
  let inFence = false;
  let fenceChar = '';

  return markdown
    .split('\n')
    .map((line) => {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        if (!inFence) {
          inFence = true;
          fenceChar = marker[0];
        } else if (marker[0] === fenceChar) {
          inFence = false;
        }
        return line;
      }

      if (inFence) return line;

      const headingMatch = line.match(/^(#{1,6})(\s.*)?$/);
      if (headingMatch) {
        return `#${line}`;
      }

      return line;
    })
    .join('\n');
}

export function buildCanonAll(input: CanonAllInput): string {
  const sections = input.kits
    .map((kit) => `---\n\n## ${kit.title}\n\n${demoteHeadings(kit.body.trim())}\n`)
    .join('\n');

  return `${FRONTMATTER}\n${input.routerBody.trim()}\n\n${sections}`;
}
