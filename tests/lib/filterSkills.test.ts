import { describe, it, expect } from 'vitest';
import { filterSkills } from '../../src/lib/filterSkills';

const skills = [
  { slug: 'a', tools: ['cursor'], categories: ['motion'] },
  { slug: 'b', tools: ['codex'], categories: ['motion'] },
  { slug: 'c', tools: ['cursor'], categories: ['accessibility'] },
  { slug: 'd', tools: ['figma'], categories: ['ui-aesthetics'] },
];

describe('filterSkills', () => {
  it('returns everything when no filters are active', () => {
    expect(filterSkills(skills, { tools: [], categories: [] })).toHaveLength(4);
  });

  it('ORs multiple selections within the tools facet', () => {
    const result = filterSkills(skills, { tools: ['cursor', 'codex'], categories: [] });
    expect(result.map((s) => s.slug).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ORs multiple selections within the categories facet', () => {
    const result = filterSkills(skills, { tools: [], categories: ['motion', 'accessibility'] });
    expect(result.map((s) => s.slug).sort()).toEqual(['a', 'b', 'c']);
  });

  it('ANDs across facet groups', () => {
    const result = filterSkills(skills, { tools: ['cursor'], categories: ['motion'] });
    expect(result.map((s) => s.slug)).toEqual(['a']);
  });

  it('returns an empty array when no skill satisfies both facets', () => {
    const result = filterSkills(skills, { tools: ['figma'], categories: ['motion'] });
    expect(result).toEqual([]);
  });
});
