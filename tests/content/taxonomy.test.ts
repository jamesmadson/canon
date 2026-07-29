import { describe, it, expect } from 'vitest';
import { TOOL_VALUES, CATEGORY_VALUES } from '../../src/content/skillSchema';
import { TOOL_META } from '../../src/lib/toolMeta';
import { CATEGORY_META } from '../../src/lib/categoryMeta';

describe('taxonomy metadata', () => {
  it('has a TOOL_META entry for every schema tool value', () => {
    for (const tool of TOOL_VALUES) {
      expect(TOOL_META[tool], `missing TOOL_META for "${tool}"`).toBeDefined();
    }
  });

  it('has a CATEGORY_META entry for every schema category value', () => {
    for (const category of CATEGORY_VALUES) {
      expect(CATEGORY_META[category], `missing CATEGORY_META for "${category}"`).toBeDefined();
    }
  });
});
