import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Phase-1 client gzip budget (18 KB). Also enforced in tsup onSuccess. */
const MAX_GZIP = 18_432;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundles = [
  { label: 'ESM', file: resolve(root, 'packages/client/dist/index.js') },
  {
    label: 'IIFE',
    file: resolve(root, 'packages/client/dist/licensecore-client.min.js'),
  },
];

let failed = false;
for (const { label, file } of bundles) {
  const raw = readFileSync(file);
  const gz = gzipSync(raw).length;
  const report = { label, file, bytes: raw.length, gzip: gz, limit: MAX_GZIP };
  console.log(JSON.stringify(report, null, 2));
  if (gz > MAX_GZIP) {
    console.error(`FAIL: ${label} gzip ${gz} exceeds ${MAX_GZIP}`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
