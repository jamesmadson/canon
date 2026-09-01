import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // One gate command for the whole repo. The site's suite is TypeScript under
    // tests/; the CLI ships as plain JavaScript with its own package, so its
    // suite is named explicitly rather than left to the default glob.
    include: ['tests/**/*.test.ts', 'cli/tests/**/*.test.js'],
  },
});
