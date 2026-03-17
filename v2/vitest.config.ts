import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    sequence: { concurrent: false },
    fileParallelism: false,
    env: {
      DATABASE_URL: 'postgresql://hedgelab:hedgelab@localhost:5432/hedgelab_v2',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
