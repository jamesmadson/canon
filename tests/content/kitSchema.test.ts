import { describe, it, expect } from 'vitest';
import { kitSchema } from '../../src/content/kitSchema';

const validKit = {
  slug: 'full-redesign',
  name: 'Full Redesign',
  tagline: 'Brand foundation through pre-ship audits.',
  phases: [
    {
      title: 'Brand foundation',
      entries: [{ skill: 'brand-guidelines', why: 'Encode the real brand so agents respect it.' }],
    },
  ],
  digestPath: '/kits/full-redesign-digest.md',
  addedDate: '2026-08-12',
  status: 'active',
};

describe('kitSchema', () => {
  it('parses a valid kit', () => {
    const result = kitSchema.parse(validKit);
    expect(result.name).toBe('Full Redesign');
    expect(result.phases[0].entries[0].skill).toBe('brand-guidelines');
  });

  it('rejects a kit with no phases', () => {
    expect(() => kitSchema.parse({ ...validKit, phases: [] })).toThrow();
  });

  it('rejects a phase with no entries', () => {
    const bad = [{ title: 'Empty phase', entries: [] }];
    expect(() => kitSchema.parse({ ...validKit, phases: bad })).toThrow();
  });

  it('rejects an unknown status', () => {
    expect(() => kitSchema.parse({ ...validKit, status: 'draft' })).toThrow();
  });

  it('rejects an entry missing its why line', () => {
    const bad = [{ title: 'Phase', entries: [{ skill: 'brand-guidelines' }] }];
    expect(() => kitSchema.parse({ ...validKit, phases: bad })).toThrow();
  });
});
