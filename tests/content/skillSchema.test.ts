import { describe, it, expect } from 'vitest';
import { skillSchema } from '../../src/content/skillSchema';

const validSkill = {
  slug: 'frontend-design',
  name: 'Frontend Design',
  tagline: 'A tagline.',
  sourceUrl: 'https://github.com/anthropics/skills',
  sourceAuthor: 'Anthropic',
  tools: ['claude'],
  categories: ['ui-aesthetics'],
  previewType: 'image',
  previewAssets: ['/previews/frontend-design.svg'],
  rating: 5,
  addedDate: '2026-07-01',
  lastVerified: '2026-07-29',
  status: 'active',
  featured: true,
};

describe('skillSchema', () => {
  it('parses a valid skill entry', () => {
    const result = skillSchema.parse(validSkill);
    expect(result.name).toBe('Frontend Design');
    expect(result.featured).toBe(true);
  });

  it('defaults featured to false when omitted', () => {
    const { featured, ...rest } = validSkill;
    const result = skillSchema.parse(rest);
    expect(result.featured).toBe(false);
  });

  it('rejects an unknown tool value', () => {
    expect(() => skillSchema.parse({ ...validSkill, tools: ['photoshop'] })).toThrow();
  });

  it('rejects an unknown category value', () => {
    expect(() => skillSchema.parse({ ...validSkill, categories: ['branding'] })).toThrow();
  });

  it('rejects a rating outside 1-5', () => {
    expect(() => skillSchema.parse({ ...validSkill, rating: 6 })).toThrow();
  });

  it('rejects a missing required field', () => {
    const { tagline, ...rest } = validSkill;
    expect(() => skillSchema.parse(rest)).toThrow();
  });
});
