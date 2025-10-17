import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ["**/*.client.test.ts", "jsdom"],
      ["**/*.server.test.ts", "node"],
    ],
    globals: true,
    setupFiles: ['vitest.setup.ts'],
    onConsoleLog(log) {
      if (/console\.warn/.test(log) || log.startsWith('[warn]')) {
        throw new Error(`Forbidden console.warn in tests: ${log}`);
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
