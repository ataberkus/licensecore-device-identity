import path from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // HTTPS so LAN devices get a secure context (crypto.subtle / WebCrypto).
  // Plain http://192.168.x.x is NOT secure — digest/sign will crash.
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      // Prefer workspace source over dist for HMR / avoid stale or missing builds.
      '@licensecore/client': path.resolve(root, '../../packages/client/src/index.ts'),
      '@licensecore/shared/constants/collectors': path.resolve(
        root,
        '../../packages/shared/src/constants/collectors.ts',
      ),
      '@licensecore/shared/constants/thresholds': path.resolve(
        root,
        '../../packages/shared/src/constants/thresholds.ts',
      ),
      '@licensecore/shared/crypto/hash': path.resolve(
        root,
        '../../packages/shared/src/crypto/hash.ts',
      ),
      '@licensecore/shared': path.resolve(root, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
