import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Windows runners are slower for fs-heavy tests (notebook-trace,
    // provenance-validator integration). 15s gives headroom without masking
    // real hangs.
    testTimeout: 15_000,
  },
});
