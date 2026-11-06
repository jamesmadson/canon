import { describe, it, expect } from 'vitest';
import { skillSchema } from '../../src/content/skillSchema';

const validSkill = {
  slug: 'deter',
  name: 'Deter',
  tagline: 'A tagline.',
  sourceUrl: 'https://github.com/jamesmadson/canon/tree/main/plugin/deter/skills/deter',
  sourceAuthor: 'James Madson',
  license: 'MIT',
  tools: ['claude'],
  previewType: 'image',
  previewAssets: ['/previews/deter.svg'],
  prompt: 'Do the thing.',
  notice: ['It did the thing.', 'It stopped there.'],
  next: 'Ask for the next thing.',
  addedDate: '2026-07-01',
  status: 'active',
};

describe('skillSchema', () => {
  it('parses a valid skill entry', () => {
    const result = skillSchema.parse(validSkill);
    expect(result.name).toBe('Deter');
  });

  it('rejects an unknown tool value', () => {
    expect(() => skillSchema.parse({ ...validSkill, tools: ['photoshop'] })).toThrow();
  });

  it('rejects a missing required field', () => {
    const { tagline, ...rest } = validSkill;
    expect(() => skillSchema.parse(rest)).toThrow();
  });

  it('requires a license', () => {
    const { license, ...withoutLicense } = validSkill;
    expect(() => skillSchema.parse(withoutLicense)).toThrow();
  });

  it('rejects a license outside the known set', () => {
    expect(() => skillSchema.parse({ ...validSkill, license: 'WTFPL' })).toThrow();
  });

  it("accepts a 'page' preview, a page the skill made, shown in a frame", () => {
    const result = skillSchema.parse({ ...validSkill, previewType: 'page', previewAssets: ['/previews/graft/demo-session.html'] });
    expect(result.previewType).toBe('page');
  });

  it("accepts a 'reply' preview, the text a skill wrote back, and a 'file' preview, a file it wrote", () => {
    expect(skillSchema.parse({ ...validSkill, previewType: 'reply', previewAssets: ['/previews/prune/review.md'] }).previewType).toBe('reply');
    expect(skillSchema.parse({ ...validSkill, previewType: 'file', previewAssets: ['/previews/strata/entry.md'] }).previewType).toBe('file');
  });

  it('takes an optional note under the preview', () => {
    expect(skillSchema.parse(validSkill).previewNote).toBeUndefined();
    expect(skillSchema.parse({ ...validSkill, previewNote: 'A real run.' }).previewNote).toBe('A real run.');
  });

  // Mutation: dropping .min(2) from notice in skillSchema.ts fails this.
  it('needs a prompt, two to four notice lines under 120 characters, and a next paragraph', () => {
    const { prompt, ...noPrompt } = validSkill;
    expect(() => skillSchema.parse(noPrompt)).toThrow();
    expect(() => skillSchema.parse({ ...validSkill, notice: ['One.'] })).toThrow();
    expect(() => skillSchema.parse({ ...validSkill, notice: ['a', 'b', 'c', 'd', 'e'] })).toThrow();
    expect(() => skillSchema.parse({ ...validSkill, notice: ['a', 'x'.repeat(120)] })).toThrow();
    const { next, ...noNext } = validSkill;
    expect(() => skillSchema.parse(noNext)).toThrow();
  });

  // Mutation: dropping .startsWith('/previews/') fails this.
  it('takes an optional subject served from /previews/', () => {
    expect(skillSchema.parse(validSkill).subject).toBeUndefined();
    expect(skillSchema.parse({ ...validSkill, subject: '/previews/prune/pricing.html' }).subject).toBe('/previews/prune/pricing.html');
    expect(() => skillSchema.parse({ ...validSkill, subject: 'https://example.com/x.html' })).toThrow();
  });

  it('rejects a preview type outside the known set', () => {
    expect(() => skillSchema.parse({ ...validSkill, previewType: 'video' })).toThrow();
  });

  it("accepts 'none' so an unlicensed source can be stated rather than omitted", () => {
    const result = skillSchema.parse({ ...validSkill, license: 'none' });
    expect(result.license).toBe('none');
  });
});
