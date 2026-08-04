import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Phase-1 client ESM gzip budget (18 KB). Also enforced in tsup onSuccess. */
const MAX_GZIP = 18_432;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'packages/client/dist/index.js');
const raw = readFileSync(file);
const gz = gzipSync(raw).length;
const report = { file, bytes: raw.length, gzip: gz, limit: MAX_GZIP };
console.log(JSON.stringify(report, null, 2));
if (gz > MAX_GZIP) {
  console.error(`FAIL: client gzip ${gz} exceeds ${MAX_GZIP}`);
  process.exitCode = 1;
}
