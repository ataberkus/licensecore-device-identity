import { createPrivateKey, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MemoryDeviceStore } from '../db/memory-store.js';
import { testEnv } from '../env.js';
import { createApp } from '../index.js';
import { NonceStore } from '../resolve/nonce.js';
import { runResolve } from '../resolve/algorithm.js';
import { bytesToB64url } from '../crypto/webauthn.js';
import { signatureMessage } from '../resolve/verify-anchor.js';
import { REBIND_MIN_IDLE_MS } from '@licensecore/shared';
import {
  generateTier2Key,
  makeEvidence,
  makeResolveRequest,
  makeServerSignals,
  signTier2,
  stableHashFrom,
  makeComponentHashes,
} from '../test-helpers.js';

const ORIGIN = 'https://app.example';

function signWithPem(
  privateKeyPem: string,
  nonce: string,
  origin: string,
  stableHash: string,
  keyId: string,
): string {
  const key = createPrivateKey(privateKeyPem);
  const message = signatureMessage({ nonce, origin, stableHash, keyId });
  const sig = sign('sha256', message, { key, dsaEncoding: 'ieee-p1363' });
  return bytesToB64url(new Uint8Array(sig));
}

describe('resolve algorithm branches', () => {
  it('returns 401 SIGNATURE_INVALID on bad sig and never enrolls', async () => {
    const store = new MemoryDeviceStore();
    const nonces = new NonceStore();
    const now = Date.now();
    const { nonce } = nonces.issue(ORIGIN, now);
    const key = generateTier2Key();
    const evidence = makeEvidence('device-a');

    const result = await runResolve(
      makeResolveRequest({
        nonce,
        origin: ORIGIN,
        evidence,
        anchor: {
          tier: 2,
          keyId: key.keyId,
          signature: 'AA'.repeat(32), // invalid
          publicKeySpki: key.publicKeySpkiB64url,
        },
      }),
      makeServerSignals(),
      { store, nonces, jwtSecret: testEnv().jwtSecret, nowMs: now },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.code).toBe('SIGNATURE_INVALID');
      expect(result.branch).toBe('signature_fail');
    }
    expect(store.devices.size).toBe(0);
  });

  it('RECOGNIZE when keyId known — device_id unchanged', async () => {
    const store = new MemoryDeviceStore();
    const nonces = new NonceStore();
    const now = Date.now();
    const key = generateTier2Key();
    const evidence = makeEvidence('stable-device');
    const env = testEnv();

    // First enroll
    const n1 = nonces.issue(ORIGIN, now);
    const sig1 = signWithPem(
      key.privateKeyPem,
      n1.nonce,
      ORIGIN,
      evidence.stableHash,
      key.keyId,
    );
    const enroll = await runResolve(
      makeResolveRequest({
        nonce: n1.nonce,
        origin: ORIGIN,
        evidence,
        anchor: {
          tier: 2,
          keyId: key.keyId,
          signature: sig1,
          publicKeySpki: key.publicKeySpkiB64url,
        },
      }),
      makeServerSignals(),
      { store, nonces, jwtSecret: env.jwtSecret, nowMs: now },
    );
    expect(enroll.ok).toBe(true);
    if (!enroll.ok) return;
    expect(enroll.branch).toBe('enroll');
    const deviceId = enroll.response.deviceId;

    // Recognize
    const n2 = nonces.issue(ORIGIN, now + 1000);
    const sig2 = signWithPem(
      key.privateKeyPem,
      n2.nonce,
      ORIGIN,
      evidence.stableHash,
      key.keyId,
    );
    const recog = await runResolve(
      makeResolveRequest({
        nonce: n2.nonce,
        origin: ORIGIN,
        evidence,
        anchor: {
          tier: 2,
          keyId: key.keyId,
          signature: sig2,
        },
      }),
      makeServerSignals(),
      { store, nonces, jwtSecret: env.jwtSecret, nowMs: now + 1000 },
    );
    expect(recog.ok).toBe(true);
    if (!recog.ok) return;
    expect(recog.branch).toBe('recognize');
    expect(recog.response.deviceId).toBe(deviceId);
    expect(recog.response.isNew).toBe(false);
    expect(recog.response.rebound).toBe(false);
  });

  it('REBIND when unknown keyId matches single strong candidate', async () => {
    const store = new MemoryDeviceStore();
    const nonces = new NonceStore();
    const now = Date.now();
    const env = testEnv();
    const key1 = generateTier2Key();
    const key2 = generateTier2Key();
    const evidence = makeEvidence('same-machine');
    const signals = makeServerSignals({ asn: 100 });

    const n1 = nonces.issue(ORIGIN, now);
    const sig1 = signWithPem(
      key1.privateKeyPem,
      n1.nonce,
      ORIGIN,
      evidence.stableHash,
      key1.keyId,
    );
    const first = await runResolve(
      makeResolveRequest({
        nonce: n1.nonce,
        origin: ORIGIN,
        evidence,
        anchor: {
          tier: 2,
          keyId: key1.keyId,
          signature: sig1,
          publicKeySpki: key1.publicKeySpkiB64url,
        },
      }),
      signals,
      { store, nonces, jwtSecret: env.jwtSecret, nowMs: now },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const originalId = first.response.deviceId;

    // New key, same evidence → rebind
    const n2 = nonces.issue(ORIGIN, now + 2000);
    const sig2 = signWithPem(
      key2.privateKeyPem,
      n2.nonce,
      ORIGIN,
      evidence.stableHash,
      key2.keyId,
    );
    const rebound = await runResolve(
      makeResolveRequest({
        nonce: n2.nonce,
        origin: ORIGIN,
        evidence,
        anchor: {
          tier: 2,
          keyId: key2.keyId,
          signature: sig2,
          publicKeySpki: key2.publicKeySpkiB64url,
        },
      }),
      signals,
      { store, nonces, jwtSecret: env.jwtSecret, nowMs: now + 4000 },
    );
    expect(rebound.ok).toBe(true);
    if (!rebound.ok) return;
    expect(rebound.branch).toBe('rebind');
    expect(rebound.response.deviceId).toBe(originalId);
    expect(rebound.response.rebound).toBe(true);
    expect(rebound.response.isNew).toBe(false);
  });

  it('refuses rebind when spoofScore ≥ 40 and enrolls instead', async () => {
    const store = new MemoryDeviceStore();
    const nonces = new NonceStore();
    const now = Date.now();
    const env = testEnv();
    const key1 = generateTier2Key();
    const key2 = generateTier2Key();
    const evidence = makeEvidence('spoofed');
    const signals = makeServerSignals({ asn: 200 });

    const n1 = nonces.issue(ORIGIN, now);
    const sig1 = signWithPem(
      key1.privateKeyPem,
      n1.nonce,
      ORIGIN,
      evidence.stableHash,
      key1.keyId,
    );
    const first = await runResolve(
      makeResolveRequest({
        nonce: n1.nonce,
        origin: ORIGIN,
        evidence,
        anchor: {
          tier: 2,
          keyId: key1.keyId,
          signature: sig1,
          publicKeySpki: key1.publicKeySpkiB64url,
        },
      }),
      signals,
      { store, nonces, jwtSecret: env.jwtSecret, nowMs: now },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const originalId = first.response.deviceId;

    // High spoof via automation + native tampering (≥40)
    const spoofEvidence = makeEvidence('spoofed', {
      nativeCodeTampering: true,
      automationMarkers: true,
    });
    // Keep same S hashes so match would otherwise rebind
    spoofEvidence.componentHashes = evidence.componentHashes;
    spoofEvidence.stableHash = evidence.stableHash;

    const n2 = nonces.issue(ORIGIN, now + 3000);
    const sig2 = signWithPem(
      key2.privateKeyPem,
      n2.nonce,
      ORIGIN,
      spoofEvidence.stableHash,
      key2.keyId,
    );
    const result = await runResolve(
      makeResolveRequest({
        nonce: n2.nonce,
        origin: ORIGIN,
        evidence: spoofEvidence,
        anchor: {
          tier: 2,
          keyId: key2.keyId,
          signature: sig2,
          publicKeySpki: key2.publicKeySpkiB64url,
        },
      }),
      signals,
      { store, nonces, jwtSecret: env.jwtSecret, nowMs: now + 4000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.branch).toBe('enroll');
    expect(result.response.deviceId).not.toBe(originalId);
    expect(result.response.isNew).toBe(true);
    expect(result.response.rebound).toBe(false);
    expect(result.response.spoofScore).toBeGreaterThanOrEqual(40);
    expect(store.events.some((e) => e.type === 'spoof_flag')).toBe(true);
  });

  it('AMBIGUOUS enroll when ≥2 candidates ≥ 0.75', async () => {
    const store2 = new MemoryDeviceStore();
    const nonces2 = new NonceStore();
    const now = Date.now();
    const env = testEnv();
    const e = makeEvidence('ambig');
    const s = makeServerSignals({ asn: 400 });

    for (let i = 0; i < 2; i++) {
      const n = nonces2.issue(ORIGIN, now + i);
      const r = await runResolve(
        makeResolveRequest({
          nonce: n.nonce,
          origin: ORIGIN,
          evidence: e,
          anchor: null,
        }),
        s,
        { store: store2, nonces: nonces2, jwtSecret: env.jwtSecret, nowMs: now + i },
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.branch).toBe('tier3_enroll');
    }
    expect(store2.devices.size).toBe(2);

    const key = generateTier2Key();
    // Past REBIND_MIN_IDLE_MS so both tier-3 devices remain rebind candidates.
    const ambNow = now + REBIND_MIN_IDLE_MS + 100;
    const n3 = nonces2.issue(ORIGIN, ambNow);
    const sig = signWithPem(
      key.privateKeyPem,
      n3.nonce,
      ORIGIN,
      e.stableHash,
      key.keyId,
    );
    const amb = await runResolve(
      makeResolveRequest({
        nonce: n3.nonce,
        origin: ORIGIN,
        evidence: e,
        anchor: {
          tier: 2,
          keyId: key.keyId,
          signature: sig,
          publicKeySpki: key.publicKeySpkiB64url,
        },
      }),
      s,
      { store: store2, nonces: nonces2, jwtSecret: env.jwtSecret, nowMs: ambNow },
    );
    expect(amb.ok).toBe(true);
    if (!amb.ok) return;
    expect(amb.branch).toBe('ambiguous_enroll');
    expect(amb.response.isNew).toBe(true);
    expect(amb.response.needsReview).toBe(true);
    expect(amb.response.confidence).toBe('low');
    expect(store2.links.length).toBeGreaterThanOrEqual(2);
  });

  it('HTTP route: bad signature → 401', async () => {
    const store = new MemoryDeviceStore();
    const nonces = new NonceStore();
    const app = createApp({
      env: testEnv(),
      store,
      nonces,
      memory: true,
    });

    const ch = await app.request('http://localhost/v1/device/challenge', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ origin: ORIGIN }),
    });
    expect(ch.status).toBe(200);
    const { nonce } = (await ch.json()) as { nonce: string };
    const key = generateTier2Key();
    const evidence = makeEvidence('http-bad-sig');

    const res = await app.request('http://localhost/v1/device/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({
        nonce,
        origin: ORIGIN,
        evidence,
        anchor: {
          tier: 2,
          keyId: key.keyId,
          signature: 'deadbeef'.repeat(8),
          publicKeySpki: key.publicKeySpkiB64url,
        },
      }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SIGNATURE_INVALID');
    expect(store.devices.size).toBe(0);
  });
});

describe('test helper signTier2', () => {
  it('roundtrips', () => {
    const key = generateTier2Key();
    const components = makeComponentHashes('x');
    const stable = stableHashFrom(components);
    const sig = signTier2({
      privateKeyPem: key.privateKeyPem,
      nonce: 'aa'.repeat(32),
      origin: ORIGIN,
      stableHash: stable,
      keyId: key.keyId,
    });
    expect(sig.length).toBeGreaterThan(10);
  });
});
