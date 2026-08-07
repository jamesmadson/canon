import { describe, it, expect } from 'vitest';
import { parseSkillHeadings } from '../../src/lib/parseSkillHeadings';

describe('parseSkillHeadings', () => {
  it('extracts flat H2 sections with no subsections', () => {
    const markdown = `# Frontend Design
## Ground it in the subject
Some text.
## Design principles
More text.
## Process: brainstorm, explore, plan, critique, build, critique again
## Restraint and self-critique
## More on writing in design
`;
    const result = parseSkillHeadings(markdown);
    expect(result).toEqual([
      { title: 'Ground it in the subject', subsections: [] },
      { title: 'Design principles', subsections: [] },
      { title: 'Process: brainstorm, explore, plan, critique, build, critique again', subsections: [] },
      { title: 'Restraint and self-critique', subsections: [] },
      { title: 'More on writing in design', subsections: [] },
    ]);
  });

  it('nests H3 lines under the preceding H2', () => {
    const markdown = `## 2. Craft Rules — How to Compose
### 2.1 Visual Hierarchy: The Three-Layer Rule
### 2.2 Font Discipline
## 3. Anti-Patterns — What to Never Do
`;
    const result = parseSkillHeadings(markdown);
    expect(result).toEqual([
      {
        title: '2. Craft Rules — How to Compose',
        subsections: ['2.1 Visual Hierarchy: The Three-Layer Rule', '2.2 Font Discipline'],
      },
      { title: '3. Anti-Patterns — What to Never Do', subsections: [] },
    ]);
  });

  it('returns an empty array for markdown with no ## headings', () => {
    const markdown = `# Just a title\nSome unstructured prose.\nMore prose.\n`;
    expect(parseSkillHeadings(markdown)).toEqual([]);
  });

  it('ignores an H3 that appears before any H2', () => {
    const markdown = `# Title\n### Orphan subsection\n## Real section\n### Real subsection\n`;
    const result = parseSkillHeadings(markdown);
    expect(result).toEqual([{ title: 'Real section', subsections: ['Real subsection'] }]);
  });
});
