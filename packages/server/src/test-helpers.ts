import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  sign,
} from 'node:crypto';
import {
  COLLECTOR_CLASS,
  PROFILE_COLLECTOR_IDS,
  S_COLLECTOR_IDS,
  type ComponentHashes,
  type EvidenceBundle,
  type EvidenceProfile,
  type IntegrityReport,
  type ResolveRequest,
  type ServerSignals,
} from '@licensecore/shared';
import { bytesToB64url } from './crypto/webauthn.js';
import { signatureMessage } from './resolve/verify-anchor.js';

export function emptyIntegrity(
  overrides: Partial<IntegrityReport> = {},
): IntegrityReport {
  return {
    nativeCodeTampering: false,
    canvasNoise: false,
    audioNoise: false,
    crossSignalContradiction: false,
    automationMarkers: false,
    privacyHardening: false,
    vmMarkers: false,
    spoofScore: 0,
    ...overrides,
  };
}

export function makeComponentHashes(
  seed: string,
  mutate?: Partial<Record<string, string>>,
  profile: EvidenceProfile = 'full',
): ComponentHashes {
  const out: ComponentHashes = {};
  for (const id of PROFILE_COLLECTOR_IDS[profile]) {
    const h = createHash('sha256')
      .update(`${seed}:${id}`)
      .digest('hex')
      .slice(0, 32);
    out[id] = {
      h: mutate?.[id] ?? h,
      class: COLLECTOR_CLASS[id],
    };
  }
  return out;
}

export function stableHashFrom(components: ComponentHashes): string {
  const parts: string[] = [];
  for (const id of S_COLLECTOR_IDS) {
    const e = components[id];
    if (!e || e.error) continue;
    parts.push(`${id}:${e.h.toLowerCase()}`);
  }
  parts.sort();
  return createHash('sha256')
    .update(parts.join('|'), 'utf8')
    .digest('hex')
    .slice(0, 32);
}

export function makeEvidence(
  seed: string,
  integrity?: Partial<IntegrityReport>,
  profile: EvidenceProfile = 'full',
): EvidenceBundle {
  const componentHashes = makeComponentHashes(seed, undefined, profile);
  return {
    schemaVersion: 1,
    profile,
    componentHashes,
    stableHash: stableHashFrom(componentHashes),
    volatileHash: createHash('sha256')
      .update(`v:${seed}`)
      .digest('hex')
      .slice(0, 32),
    integrity: emptyIntegrity(integrity),
    collectedAtMs: Date.now(),
    budgetMs: 400,
  };
}

export function makeServerSignals(
  overrides: Partial<ServerSignals> = {},
): ServerSignals {
  return {
    ipHash: 'a'.repeat(64),
    ip24Hash: 'b'.repeat(64),
    asn: 64512,
    acceptLanguage: 'en-US,en;q=0.9',
    headerOrderHash: 'c'.repeat(32),
    ja4: null,
    userAgent: 'test-agent',
    ...overrides,
  };
}

export function generateTier2Key(): {
  publicKeySpkiB64url: string;
  privateKeyPem: string;
  keyId: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const spki = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const publicKeySpkiB64url = bytesToB64url(new Uint8Array(spki));
  const keyId = createHash('sha256').update(spki).digest('hex').slice(0, 32);
  const privateKeyPem = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
  return { publicKeySpkiB64url, privateKeyPem, keyId };
}

export function signTier2(opts: {
  privateKeyPem: string;
  nonce: string;
  origin: string;
  stableHash: string;
  keyId: string;
}): string {
  const key = createPrivateKey(opts.privateKeyPem);
  const message = signatureMessage({
    nonce: opts.nonce,
    origin: opts.origin,
    stableHash: opts.stableHash,
    keyId: opts.keyId,
  });
  const sig = sign('sha256', message, { key, dsaEncoding: 'ieee-p1363' });
  return bytesToB64url(new Uint8Array(sig));
}

export function makeResolveRequest(opts: {
  nonce: string;
  origin: string;
  evidence: EvidenceBundle;
  anchor: ResolveRequest['anchor'];
}): ResolveRequest {
  return {
    nonce: opts.nonce,
    origin: opts.origin,
    anchor: opts.anchor,
    evidence: opts.evidence,
  };
}
