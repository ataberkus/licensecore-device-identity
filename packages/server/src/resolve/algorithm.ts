import type {
  AnchorTier,
  ResolveRequest,
  ResolveResponse,
  ServerSignals,
} from '@licensecore/shared';
import { DRIFT_TOLERANCE, REBIND_MIN_IDLE_MS } from '@licensecore/shared';
import { mintDeviceToken } from '../crypto/jwt.js';
import type { DeviceStore } from '../db/store.js';
import { nowIso } from '../db/store.js';
import { confidenceForEnroll, confidenceForRecognize, newDeviceId } from './enroll.js';
import {
  blendScore,
  compareServerSignals,
  driftFraction,
  scoreSComponents,
} from './match.js';
import type { NonceStore } from './nonce.js';
import { decideRebind } from './rebind.js';
import { privateContextHeuristic, recomputeSpoofScore } from './spoof.js';
import { verifyAnchor } from './verify-anchor.js';
import type { ErrorCode } from '@licensecore/shared';

export type ResolveBranch =
  | 'nonce_fail'
  | 'signature_fail'
  | 'recognize'
  | 'rebind'
  | 'ambiguous_enroll'
  | 'enroll'
  | 'tier3_enroll';

export type ResolveFailure = {
  ok: false;
  status: 400 | 401;
  code: ErrorCode;
  message: string;
  branch: ResolveBranch;
};

export type ResolveSuccess = {
  ok: true;
  branch: ResolveBranch;
  response: ResolveResponse;
};

export type ResolveDeps = {
  store: DeviceStore;
  nonces: NonceStore;
  jwtSecret: string;
  nowMs?: number;
  log?: (msg: string, data?: Record<string, unknown>) => void;
};

/**
 * EXACT ordered resolve algorithm from the Phase 1 plan.
 * Logs which branch was taken.
 */
export async function runResolve(
  req: ResolveRequest,
  serverSignals: ServerSignals,
  deps: ResolveDeps,
): Promise<ResolveSuccess | ResolveFailure> {
  const nowMs = deps.nowMs ?? Date.now();
  const log =
    deps.log ??
    ((msg: string, data?: Record<string, unknown>) => {
      console.info(`[resolve] ${msg}`, data ?? {});
    });

  // 1. validate nonce
  const nonceResult = deps.nonces.consume(req.nonce, req.origin, nowMs);
  if (!nonceResult.ok) {
    log('branch', { branch: 'nonce_fail', code: nonceResult.error.code });
    return {
      ok: false,
      status: 400,
      code: nonceResult.error.code,
      message: nonceResult.error.message,
      branch: 'nonce_fail',
    };
  }

  const spoofScore = recomputeSpoofScore(req.evidence.integrity);
  const privateContext = privateContextHeuristic(req.evidence.integrity);
  const tier: AnchorTier = req.anchor?.tier ?? 3;

  // 2. verify anchor signature if present
  let verified: Awaited<ReturnType<typeof verifyAnchor>> | null = null;
  let existingAnchor = null as Awaited<
    ReturnType<DeviceStore['findAnchorByKeyId']>
  >;

  if (req.anchor) {
    existingAnchor = await deps.store.findAnchorByKeyId(req.anchor.keyId);
    verified = await verifyAnchor({
      anchor: req.anchor,
      nonce: req.nonce,
      origin: req.origin,
      stableHash: req.evidence.stableHash,
      existing: existingAnchor,
    });
    if (!verified.ok) {
      log('branch', { branch: 'signature_fail', reason: verified.reason });
      return {
        ok: false,
        status: 401,
        code: 'SIGNATURE_INVALID',
        message: verified.reason,
        branch: 'signature_fail',
      };
    }
  }

  const hardwareBacked = verified?.ok === true ? verified.hardwareBacked : false;
  const keyId = req.anchor?.keyId ?? '';
  const jkt = keyId;

  // 3. keyId known → RECOGNIZE
  if (req.anchor && existingAnchor && verified?.ok) {
    const device = await deps.store.findDeviceById(existingAnchor.deviceId);
    if (!device || device.retiredAt) {
      // Treat as unknown key path below by falling through — shouldn't happen
    } else {
      const latest = await deps.store.latestEvidence(device.id);
      let drifted = false;
      if (latest) {
        const frac = driftFraction(
          req.evidence.componentHashes,
          latest.componentHashes,
        );
        if (frac > DRIFT_TOLERANCE) {
          drifted = true;
          const rev = await deps.store.nextEvidenceRevision(device.id);
          await deps.store.insertEvidence({
            deviceId: device.id,
            revision: rev,
            profile: req.evidence.profile,
            stableHash: req.evidence.stableHash,
            volatileHash: req.evidence.volatileHash,
            componentHashes: req.evidence.componentHashes,
            integrity: {
              ...req.evidence.integrity,
              spoofScore,
            },
            serverSignals,
          });
          await deps.store.insertEvent({
            deviceId: device.id,
            type: 'drift',
            payload: { driftFraction: frac },
            ipHash: serverSignals.ipHash,
          });
        }
      } else {
        await deps.store.insertEvidence({
          deviceId: device.id,
          revision: 1,
          profile: req.evidence.profile,
          stableHash: req.evidence.stableHash,
          volatileHash: req.evidence.volatileHash,
          componentHashes: req.evidence.componentHashes,
          integrity: { ...req.evidence.integrity, spoofScore },
          serverSignals,
        });
      }

      if (verified.ok && verified.signCount !== existingAnchor.signCount) {
        await deps.store.updateAnchorSignCount(
          existingAnchor.keyId,
          verified.signCount,
        );
      }

      const ts = nowIso(nowMs);
      await deps.store.updateDevice(device.id, {
        lastSeenAt: ts,
        spoofScore,
        confidence: confidenceForRecognize(verified.tier),
        hardwareBacked: hardwareBacked || device.hardwareBacked,
      });
      await deps.store.insertEvent({
        deviceId: device.id,
        type: 'recognize',
        payload: { drifted, tier: verified.tier },
        ipHash: serverSignals.ipHash,
      });

      const { token } = await mintDeviceToken({
        deviceId: device.id,
        jkt,
        secret: deps.jwtSecret,
        nowMs,
      });

      log('branch', { branch: 'recognize', deviceId: device.id, drifted });
      const response: ResolveResponse = {
        deviceId: device.id,
        isNew: false,
        confidence: confidenceForRecognize(verified.tier),
        anchorTier: verified.tier,
        hardwareBacked: hardwareBacked || device.hardwareBacked,
        rebound: false,
        deviceToken: token,
        spoofScore,
      };
      if (privateContext) response.privateContext = true;
      return { ok: true, branch: 'recognize', response };
    }
  }

  // 4. keyId unknown (or Tier 3) → weighted S match + blend
  const candidates = await deps.store.findCandidates({
    asn: serverSignals.asn,
    stableHash: req.evidence.stableHash,
    profile: req.evidence.profile,
    nowMs,
  });

  const scored = candidates
    .map((c) => {
      const base = scoreSComponents(
        req.evidence.componentHashes,
        c.componentHashes,
      );
      const flags = compareServerSignals(serverSignals, c.serverSignals);
      const score = blendScore(base, flags);
      return { deviceId: c.deviceId, score, baseScore: base, device: c.device };
    })
    .filter((c) => {
      // Concurrent second profile (T5): device just seen → do not silent-rebind.
      const last = Date.parse(c.device.lastSeenAt);
      if (Number.isFinite(last) && nowMs - last < REBIND_MIN_IDLE_MS) {
        return false;
      }
      return true;
    })
    .map(({ deviceId, score, baseScore }) => ({ deviceId, score, baseScore }));

  // Tier 3: never silent high-confidence rebind — enroll or weak path only
  const decision =
    tier === 3
      ? ({ action: 'enroll' } as const)
      : decideRebind({ spoofScore, candidates: scored });

  if (decision.action === 'rebind' && req.anchor && verified?.ok) {
    const deviceId = decision.deviceId;
    const rev = await deps.store.nextEvidenceRevision(deviceId);
    await deps.store.insertEvidence({
      deviceId,
      revision: rev,
      profile: req.evidence.profile,
      stableHash: req.evidence.stableHash,
      volatileHash: req.evidence.volatileHash,
      componentHashes: req.evidence.componentHashes,
      integrity: { ...req.evidence.integrity, spoofScore },
      serverSignals,
    });
    await deps.store.insertAnchor({
      deviceId,
      tier: verified.tier,
      keyId: verified.keyId,
      publicKeySpki: verified.publicKeySpki,
      aaguid: verified.aaguid,
      beFlag: verified.beFlag,
      bsFlag: verified.bsFlag,
      signCount: verified.signCount,
    });
    const ts = nowIso(nowMs);
    await deps.store.updateDevice(deviceId, {
      lastSeenAt: ts,
      spoofScore,
      confidence: 'medium',
      hardwareBacked,
    });
    await deps.store.insertEvent({
      deviceId,
      type: 'rebind',
      payload: { score: decision.score, keyId: verified.keyId },
      ipHash: serverSignals.ipHash,
    });

    const { token } = await mintDeviceToken({
      deviceId,
      jkt,
      secret: deps.jwtSecret,
      nowMs,
    });

    log('branch', { branch: 'rebind', deviceId, score: decision.score });
    const response: ResolveResponse = {
      deviceId,
      isNew: false,
      confidence: 'medium',
      anchorTier: verified.tier,
      hardwareBacked,
      rebound: true,
      deviceToken: token,
      spoofScore,
    };
    if (privateContext) response.privateContext = true;
    return { ok: true, branch: 'rebind', response };
  }

  // 4b ambiguous or 4c enroll
  const needsReview = decision.action === 'ambiguous';
  const branch: ResolveBranch =
    tier === 3
      ? 'tier3_enroll'
      : needsReview
        ? 'ambiguous_enroll'
        : 'enroll';

  const deviceId = newDeviceId();
  const conf = needsReview
    ? ('low' as const)
    : confidenceForEnroll(tier, hardwareBacked);

  await deps.store.insertDevice({
    id: deviceId,
    confidence: conf,
    spoofScore,
    hardwareBacked,
    needsReview,
  });
  await deps.store.insertEvidence({
    deviceId,
    revision: 1,
    profile: req.evidence.profile,
    stableHash: req.evidence.stableHash,
    volatileHash: req.evidence.volatileHash,
    componentHashes: req.evidence.componentHashes,
    integrity: { ...req.evidence.integrity, spoofScore },
    serverSignals,
  });

  if (req.anchor && verified?.ok) {
    await deps.store.insertAnchor({
      deviceId,
      tier: verified.tier,
      keyId: verified.keyId,
      publicKeySpki: verified.publicKeySpki,
      aaguid: verified.aaguid,
      beFlag: verified.beFlag,
      bsFlag: verified.bsFlag,
      signCount: verified.signCount,
    });
  }

  await deps.store.insertEvent({
    deviceId,
    type: needsReview ? 'ambiguous' : 'enroll',
    payload: { tier, spoofScore },
    ipHash: serverSignals.ipHash,
  });

  if (spoofScore >= 40) {
    await deps.store.insertEvent({
      deviceId,
      type: 'spoof_flag',
      payload: { spoofScore },
      ipHash: serverSignals.ipHash,
    });
  }

  if (needsReview && decision.action === 'ambiguous') {
    for (const related of decision.deviceIds) {
      await deps.store.insertLink({
        deviceId,
        relatedDeviceId: related,
        relation: 'possible_duplicate',
      });
    }
  }

  const { token } = await mintDeviceToken({
    deviceId,
    jkt,
    secret: deps.jwtSecret,
    nowMs,
  });

  log('branch', { branch, deviceId, needsReview, spoofScore });
  const response: ResolveResponse = {
    deviceId,
    isNew: true,
    confidence: conf,
    anchorTier: tier,
    hardwareBacked,
    rebound: false,
    deviceToken: token,
    spoofScore,
  };
  if (needsReview) response.needsReview = true;
  if (privateContext) response.privateContext = true;
  return { ok: true, branch, response };
}
