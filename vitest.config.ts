import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.{test,spec}.ts', 'packages/*/src/**/*.{test,spec}.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@licensecore/shared/constants/collectors': resolve(
        'packages/shared/src/constants/collectors.ts',
      ),
      '@licensecore/shared/constants/thresholds': resolve(
        'packages/shared/src/constants/thresholds.ts',
      ),
      '@licensecore/shared/crypto/hash': resolve(
        'packages/shared/src/crypto/hash.ts',
      ),
      '@licensecore/shared': resolve('packages/shared/src/index.ts'),
      '@licensecore/client': resolve('packages/client/src/index.ts'),
    },
  },
});
