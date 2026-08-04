# ADR / Decisions — Phase 1

Decisions locked to the implementation in `packages/client` and `packages/server`. Update this file when code changes.

---

## 1. Anchors outrank fingerprints

**Decision:** A valid known `keyId` + signature ⇒ **recognize** the same `device_id` regardless of S-score drift (drift only stores a revision + `drift` event). Fingerprint similarity never merges two live anchors into one id automatically when both present distinct unknown keys (T6: identical S-bundles, different anchors → two devices).

**Why:** Browser fingerprints are mutable and spoofable. Cryptographic possession of the device-bound key is the durable identity. Fingerprints exist to **rebind** after total storage wipe (new key, same machine/profile signals), not to override a healthy anchor.

**Consequence:** Stolen evidence without the key cannot high-confidence-recognize. Cleared storage with intact fingerprint may rebind (medium confidence) if gates pass.

---

## 2. Per-component hashing

**Decision:** Each collector emits a truncated SHA-256 (`h`, 128-bit hex) over **canonical JSON** of its value. Wire format sends component hashes (plus optional `ms` / `error`), not raw pixels/samples. `stableHash` / `volatileHash` aggregate sorted successful S / V `id=h` pairs.

**Why:**

- Limits PII and payload size on the wire.
- Lets match exclude `error: true` components without poisoning the aggregate.
- Enables drift measurement as a **weight fraction** of changed S hashes (`DRIFT_TOLERANCE = 0.25`).

**Why not one blob hash only:** A single hash cannot support weighted partial match or per-signal diagnostics in the playground.

---

## 3. BE===0 WebAuthn gate (`hardwareBacked`)

**Decision:**

- Tier 1 is **opt-in** (`enrollHardwareAnchor: true`); default SDK path never prompts.
- Client rejects authenticators with Backup Eligibility **BE=1** (syncable passkeys) and falls back to Tier 2.
- Server sets `hardwareBacked: true` **only** when `tier === 1` and `beFlag === false`. Enroll confidence `high` requires that combination; recognize still treats Tier 1/2 as `high` confidence for continuity.

**Why:** Syncable passkeys (iCloud / Google Password Manager) follow the account, not the machine — they break “device” semantics. BE===0 keeps Tier 1 as device-bound platform auth.

**Residual:** Users who only have syncable passkeys get Tier 2 (software key in profile storage).

---

## 4. Rebind thresholds

Constants: `packages/shared/src/constants/thresholds.ts`. Logic: `match.ts` + `rebind.ts` + `algorithm.ts`.

| Gate | Value | Role |
|---|---|---|
| `REBIND_SCORE` | 0.90 | Blended score needed to rebind unknown key → existing device |
| `CANDIDATE_SCORE` | 0.75 | Minimum to count as a competing candidate |
| `BLEND_MIN_BASE_FOR_REBIND` | 0.85 | Fingerprint-only floor before server blend may push ≥ 0.90 (anti-IP-farm) |
| `SPOOF_SCORE_REBIND_BLOCK` | 40 | Server spoofScore ≥ 40 ⇒ enroll new, never rebind |
| `DRIFT_TOLERANCE` | 0.25 | Recognize-path S weight fraction changed → `drift` event |
| Candidate window | 180 days | ASN **or** `stableHash` 8-hex prefix bucket — no full scan |
| Tier 3 | — | Never silent high-confidence rebind; enroll path only |

**Ambiguity:** ≥2 candidates at ≥0.75 with at least one ≥0.90 ⇒ new enroll, `needsReview`, `possible_duplicate` links, confidence `low`.

**Server blend (additive, clamp01):** +0.03 IP/24, +0.02 ASN, +0.01 Accept-Language, +0.01 header-order, +0.02 JA4 if both present.

**Why these numbers:** High bar for attaching a new key to an old id (false rebind = identity theft); still recoverable after honest site-data clear (T4). Spoof gate blocks obvious automation/tamper from riding rebind.

---

## 5. Client never assigns `device_id`

**Decision:** Public client API returns server `ResolveResponse.deviceId` only. Local code manages keys and evidence only.

**Why:** Prevents clients from forging or “shopping” ids; server owns enroll/recognize/rebind branches and audit events.

---

## 6. Dependency license policy

**Decision:** MIT / Apache-2.0 dependencies only for this phase. No FingerprintJS / BSL fingerprint SDKs. Client published bundle: zero runtime npm deps (shared constants bundled).
