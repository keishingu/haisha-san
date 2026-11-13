import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    // DB を使うテストはファイルごとに PGlite（WASM）を起動するので、上限を広げる
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // server-only はテストでは空のモジュールにする
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
    },
  },
});
