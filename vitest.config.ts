import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // One gate command for the whole repo. The site's suite is TypeScript under
    // tests/; the CLI ships as plain JavaScript with its own package, so its
    // suite is named explicitly rather than left to the default glob.
    // Both spellings on both sides. A file named *.spec.ts was silently not
    // run, which is the one failure mode a test suite must not have.
    include: ['tests/**/*.{test,spec}.ts', 'cli/tests/**/*.{test,spec}.js'],
  },
});
