import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Specify the glob pattern for test files
    include: ['src/**/*.test.ts'],
    // Exclude node_modules and other directories
    exclude: ['node_modules', 'build', 'docs'],
    // Set up the environment for testing
    environment: 'node',
    // Enable globals like `describe`, `it`, `expect`
    globals: true,
  },
});