/**
 * Seed local SQLite with sample devices / anchors / evidence / events.
 *
 * Usage (repo root):
 *   pnpm seed
 *   DATABASE_URL=file:./data/device-identity.sqlite pnpm seed
 *
 * Uses the same default DB path as packages/server/src/dev-server.ts when unset.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../packages/server/src/db/index.js';
import { createStore } from '../packages/server/src/db/migrate.js';
import { testEnv } from '../packages/server/src/env.js';
import {
  emptyIntegrity,
  generateTier2Key,
  makeComponentHashes,
  makeServerSignals,
  stableHashFrom,
} from '../packages/server/src/test-helpers.js';
import { createHash } from 'node:crypto';
import { newDeviceId } from '../packages/server/src/resolve/enroll.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const defaultDbPath = resolve(root, 'data/device-identity.sqlite');

function dbPathFromEnv(): string {
  const url = process.env['DATABASE_URL'];
  if (!url || url === ':memory:') return defaultDbPath;
  return url.startsWith('file:') ? url.slice('file:'.length) : url;
}

async function main(): Promise<void> {
  const dbPath = dbPathFromEnv();
  mkdirSync(dirname(dbPath), { recursive: true });

  const env = testEnv({
    databaseUrl: `file:${dbPath}`,
    databaseDialect: 'sqlite',
  });
  const appDb = createDb(env);
  const store = createStore(appDb);

  const signalsA = makeServerSignals({ asn: 64512 });
  const signalsB = makeServerSignals({
    asn: 64513,
    ip24Hash: 'd'.repeat(64),
    acceptLanguage: 'tr-TR,tr;q=0.9,en;q=0.8',
  });

  // --- Device A: Tier 2, medium confidence, clean integrity ---
  const keyA = generateTier2Key();
  const componentsA = makeComponentHashes('seed-device-a');
  const stableA = stableHashFrom(componentsA);
  const volatileA = createHash('sha256')
    .update('seed-device-a:v')
    .digest('hex')
    .slice(0, 32);
  const idA = newDeviceId();

  await store.insertDevice({
    id: idA,
    confidence: 'medium',
    spoofScore: 0,
    hardwareBacked: false,
    needsReview: false,
    notes: 'seed: tier2 demo device',
  });
  await store.insertAnchor({
    deviceId: idA,
    tier: 2,
    keyId: keyA.keyId,
    publicKeySpki: keyA.publicKeySpkiB64url,
    signCount: 0,
  });
  await store.insertEvidence({
    deviceId: idA,
    revision: 1,
    profile: 'full',
    stableHash: stableA,
    volatileHash: volatileA,
    componentHashes: componentsA,
    integrity: emptyIntegrity(),
    serverSignals: signalsA,
  });
  await store.insertEvent({
    deviceId: idA,
    type: 'enroll',
    payload: { seed: true, tier: 2 },
    ipHash: signalsA.ipHash,
  });

  // --- Device B: Tier 3-style (no anchor), low confidence ---
  const componentsB = makeComponentHashes('seed-device-b');
  const stableB = stableHashFrom(componentsB);
  const volatileB = createHash('sha256')
    .update('seed-device-b:v')
    .digest('hex')
    .slice(0, 32);
  const idB = newDeviceId();

  await store.insertDevice({
    id: idB,
    confidence: 'low',
    spoofScore: 10,
    hardwareBacked: false,
    needsReview: false,
    notes: 'seed: evidence-only (tier3) device',
  });
  await store.insertEvidence({
    deviceId: idB,
    revision: 1,
    profile: 'full',
    stableHash: stableB,
    volatileHash: volatileB,
    componentHashes: componentsB,
    integrity: emptyIntegrity({ privacyHardening: true, spoofScore: 10 }),
    serverSignals: signalsB,
  });
  await store.insertEvent({
    deviceId: idB,
    type: 'enroll',
    payload: { seed: true, tier: 3 },
    ipHash: signalsB.ipHash,
  });

  // --- Device C: flagged spoof / needsReview ambiguous sibling of A bucket ---
  const componentsC = makeComponentHashes('seed-device-a', {
    webgl_gpu: createHash('sha256').update('seed-c-webgl').digest('hex').slice(0, 32),
  });
  const stableC = stableHashFrom(componentsC);
  const volatileC = createHash('sha256')
    .update('seed-device-c:v')
    .digest('hex')
    .slice(0, 32);
  const idC = newDeviceId();
  const keyC = generateTier2Key();

  await store.insertDevice({
    id: idC,
    confidence: 'low',
    spoofScore: 45,
    hardwareBacked: false,
    needsReview: true,
    notes: 'seed: spoof_flag + needsReview example',
  });
  await store.insertAnchor({
    deviceId: idC,
    tier: 2,
    keyId: keyC.keyId,
    publicKeySpki: keyC.publicKeySpkiB64url,
  });
  await store.insertEvidence({
    deviceId: idC,
    revision: 1,
    profile: 'full',
    stableHash: stableC,
    volatileHash: volatileC,
    componentHashes: componentsC,
    integrity: emptyIntegrity({
      automationMarkers: true,
      nativeCodeTampering: false,
      spoofScore: 45,
    }),
    serverSignals: signalsA,
  });
  await store.insertEvent({
    deviceId: idC,
    type: 'enroll',
    payload: { seed: true, tier: 2 },
    ipHash: signalsA.ipHash,
  });
  await store.insertEvent({
    deviceId: idC,
    type: 'spoof_flag',
    payload: { spoofScore: 45, seed: true },
    ipHash: signalsA.ipHash,
  });
  await store.insertLink({
    deviceId: idC,
    relatedDeviceId: idA,
    relation: 'possible_duplicate',
  });

  if (appDb.dialect === 'sqlite') {
    appDb.sqlite.close();
  }

  console.log(
    JSON.stringify(
      {
        database: dbPath,
        devices: [
          { id: idA, note: 'tier2 clean', keyId: keyA.keyId },
          { id: idB, note: 'tier3 evidence-only' },
          { id: idC, note: 'needsReview + spoof_flag', keyId: keyC.keyId },
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
