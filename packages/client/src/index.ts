/**
 * @licensecore/client — browser device-identity SDK.
 *
 * Collects S/V evidence and Tier 1–3 anchor proofs. The client NEVER
 * computes or sends a final `device_id` — only the server assigns it.
 */

import type {
  EvidenceBundle,
  ResolveResponse,
  ReverifyResponse,
} from '@licensecore/shared';
import { runCollectors } from './collect/runner.js';
import type { RunCollectorsOptions } from './collect/types.js';
import {
  getTier2KeyId,
  obtainAnchorProof,
  wipeAllAnchors,
  wipeLocalState,
} from './anchors/manager.js';
import { proveTier2 } from './anchors/tier2_subtle.js';
import {
  fetchChallenge,
  postResolve,
  postReverify,
  type TransportOptions,
  DeviceIdentityTransportError,
} from './api/transport.js';

export type { EvidenceBundle, ResolveResponse, ReverifyResponse };
export { DeviceIdentityTransportError };
export { runCollectors };
export { wipeAllAnchors, wipeAllAnchors as wipeAnchors, wipeLocalState };
export { fetchChallenge, postResolve, postReverify };
export { obtainAnchorProof };

export interface CollectOptions extends RunCollectorsOptions {}

/** Collect evidence only (no network, no anchor). */
export async function collect(
  options: CollectOptions = {},
): Promise<EvidenceBundle> {
  const { evidence } = await runCollectors(options);
  return evidence;
}

export interface ResolveFlowOptions extends TransportOptions {
  /** Opt into WebAuthn platform enrollment (Tier 1). Default: false. */
  enrollHardwareAnchor?: boolean;
  /** Override origin; defaults to `location.origin`. */
  origin?: string;
  /** Collector budget override. */
  budgetMs?: number;
  /** Include Tier 2 SPKI (first enroll). Default: true when no prior key known to caller. */
  includeSpki?: boolean;
}

/**
 * challenge → collect → anchor prove → resolve.
 * Returns server `ResolveResponse` (includes `deviceId` from server only).
 */
export async function resolve(
  options: ResolveFlowOptions = {},
): Promise<ResolveResponse> {
  const origin =
    options.origin ??
    (typeof location !== 'undefined' ? location.origin : '');
  if (!origin) {
    throw new Error('origin required');
  }

  const challenge = await fetchChallenge(origin, options);
  const collectOpts: CollectOptions = {};
  if (options.budgetMs !== undefined) collectOpts.budgetMs = options.budgetMs;
  const evidence = await collect(collectOpts);
  const anchor = await obtainAnchorProof(
    {
      nonce: challenge.nonce,
      origin,
      stableHash: evidence.stableHash,
    },
    {
      enrollHardwareAnchor: options.enrollHardwareAnchor === true,
      includeSpki: options.includeSpki !== false,
    },
  );

  return postResolve(
    {
      nonce: challenge.nonce,
      origin,
      anchor,
      evidence,
    },
    options,
  );
}

export interface ReverifyFlowOptions extends TransportOptions {
  origin?: string;
}

/**
 * Re-challenge and sign with existing Tier 2 key (or fail if none).
 * Does not recollect full evidence.
 */
export async function reverify(
  options: ReverifyFlowOptions = {},
): Promise<ReverifyResponse> {
  const origin =
    options.origin ??
    (typeof location !== 'undefined' ? location.origin : '');
  if (!origin) throw new Error('origin required');

  const keyId = await getTier2KeyId();
  if (!keyId) {
    throw new Error('no Tier 2 anchor to reverify');
  }

  const challenge = await fetchChallenge(origin, options);
  // stableHash rebound: use empty placeholder hash of prior? Spec says
  // ReverifyRequest is { nonce, origin, keyId, signature } — signature over
  // nonce||origin||stableHash||keyId. Without fresh evidence, bind empty
  // stableHash string; server should accept last-known binding policy.
  const stableHash = '0'.repeat(32);
  const proof = await proveTier2({
    nonce: challenge.nonce,
    origin,
    stableHash,
  });

  return postReverify(
    {
      nonce: challenge.nonce,
      origin,
      keyId: proof.keyId,
      signature: proof.signature,
    },
    options,
  );
}

export interface DeviceIdentityClientOptions extends TransportOptions {
  enrollHardwareAnchor?: boolean;
}

/** Convenience facade. */
export class DeviceIdentityClient {
  private readonly opts: DeviceIdentityClientOptions;

  constructor(opts: DeviceIdentityClientOptions = {}) {
    this.opts = opts;
  }

  collect(options?: CollectOptions): Promise<EvidenceBundle> {
    return collect(options);
  }

  resolve(options?: Omit<ResolveFlowOptions, keyof TransportOptions>): Promise<ResolveResponse> {
    return resolve({ ...this.opts, ...options });
  }

  reverify(options?: Omit<ReverifyFlowOptions, keyof TransportOptions>): Promise<ReverifyResponse> {
    return reverify({ ...this.opts, ...options });
  }

  wipeAnchors(): Promise<void> {
    return wipeAllAnchors();
  }

  wipeLocalState(): Promise<void> {
    return wipeLocalState();
  }
}
