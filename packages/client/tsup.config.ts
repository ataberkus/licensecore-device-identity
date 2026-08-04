import { defineConfig } from 'tsup';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_GZIP = 18_432; // 18 KB

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'iife'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  globalName: 'LicenseCoreClient',
  // Bundle used shared constants; keep Zod out by importing only constants/types.
  noExternal: ['@licensecore/shared'],
  treeshake: true,
  esbuildOptions(options) {
    options.legalComments = 'none';
  },
  async onSuccess() {
    const file = resolve('dist/index.js');
    if (!existsSync(file)) return;
    const raw = readFileSync(file);
    const gz = gzipSync(raw).length;
    // eslint-disable-next-line no-console
    console.log(`@licensecore/client ESM gzip: ${gz} bytes (limit ${MAX_GZIP})`);
    if (gz > MAX_GZIP) {
      throw new Error(`client bundle gzip ${gz} exceeds ${MAX_GZIP}`);
    }
  },
});
