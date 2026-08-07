export interface ContentSection {
  title: string;
  subsections: string[];
}

export function parseSkillHeadings(markdown: string): ContentSection[] {
  const sections: ContentSection[] = [];
  let current: ContentSection | null = null;

  for (const line of markdown.split('\n')) {
    const h2 = /^## (.+)$/.exec(line);
    if (h2) {
      current = { title: h2[1].trim(), subsections: [] };
      sections.push(current);
      continue;
    }
    const h3 = /^### (.+)$/.exec(line);
    if (h3 && current) {
      current.subsections.push(h3[1].trim());
    }
  }

  return sections;
}
