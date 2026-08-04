# Threat model — device identity (Phase 1)

Scope: browser evidence + crypto anchors → server-assigned `device_id`. No accounts, seats, or licenses.

**Device definition:** PHYSICAL MACHINE × BROWSER PROFILE. Same OS user with two browser profiles ⇒ two devices by design.

---

## Attacker goals

### 1. Seat multiplication (many “devices” for one human)

**Goal:** Enroll many `device_id`s from one machine to bypass a future seat limit.

**Control:** Anchors make naive “new profile = free seat” costly only when product policy binds seats to `device_id`. This subsystem alone does **not** cap seats.

**RESIDUAL RISK:** Unlimited enrolls are possible; product must attach payment/seat policy. Incognito / fresh profiles get distinct ids (`privateContext` may be set — heuristic, not a hard stop).

---

### 2. License sharing (one paid entitlement, many humans)

**Goal:** Copy tokens or evidence so friends share one license.

**Control:** `deviceToken` is short-lived JWT (10m) with `cnf.jkt` bound to anchor key id. Resolve requires single-use nonce. Stolen token expires; stolen evidence without the private anchor key does not yield **recognize**.

**RESIDUAL RISK:** Sharing a whole browser profile (synced profile / disk clone) shares Tier 2 keys and looks like the same device. Phase 2 seat/session signals needed for “same human, different location” abuse.

---

### 3. Anchor cloning

**Goal:** Extract Tier 2 ECDSA key or Tier 1 credential and use it elsewhere.

**Control:** Tier 2 keys are **non-extractable** Web Crypto in IDB (plus storage mirrors of thumbprints only). Tier 1 uses platform authenticator; client rejects **BE=1** syncable passkeys; server sets `hardwareBacked` only when BE===0.

**RESIDUAL RISK:** Malware with full profile access can use (not export) non-extractable keys in-process. VM/disk clones of a profile duplicate Tier 2 material. Syncable passkeys are rejected for hardware-backed path — users on iCloud/Google sync get Tier 2 only.

---

### 4. Fingerprint replay

**Goal:** Replay a captured `EvidenceBundle` (and/or resolve body) to impersonate a victim.

**Control:** Nonce is single-use, origin-bound, ~60s TTL. Anchor signature binds `nonce || origin || stableHash || keyId`. Replay of the same body fails (`NONCE_REPLAY` / invalid). Evidence alone without a fresh valid anchor signature cannot **recognize** a known keyId.

**RESIDUAL RISK:** Attacker who can mint a **new** Tier 2 key and present a stolen/copied S-hash bundle may still **enroll** a new device or, if scores pass gates and spoofScore &lt; 40, **rebind** onto a victim — thresholds and integrity heuristics reduce but do not eliminate this (T8).

---

### 5. Anti-detect / privacy browsers

**Goal:** Present a consistent synthetic fingerprint, pass integrity checks, multiply or migrate identities.

**Control:** Integrity report (native-code tampering, canvas/audio noise, contradictions, automation, privacy hardening, VM markers) → server-authoritative `spoofScore`. Rebind **refuses** when `spoofScore ≥ 40`. Volatile (V) signals excluded from `stableHash` / match.

**RESIDUAL RISK (explicit):** **Anti-detect browsers can align CLASS S signals and defeat integrity heuristics.** Phase 1 does not claim to detect or stop them reliably. Treat high-confidence paths as “honest browser + intact anchor,” not “unforgeable machine id.”

---

### 6. VM / GPU farms

**Goal:** Many VMs with identical GPU passthrough + cloned browser profiles ⇒ many seats or shared anchors.

**Control:** Weighted S match + server blend (IP/24, ASN, AL, header order, optional JA4) with anti-IP-farm rule: fingerprint base must be ≥ 0.85 before blend can cross 0.90. Ambiguous multi-candidate → new enroll + `needsReview`.

**RESIDUAL RISK:** Identical GPU + cloned profiles still look like one or many consistent devices; **seat/payment signals are out of scope** and required for farm economics (phase 2).

---

## Control summary

| Goal | Primary controls | Residual |
|---|---|---|
| Seat multiplication | Product policy (not here); profile isolation | Unlimited enroll |
| License sharing | Short JWT, nonce, anchor binding | Profile clone = same device |
| Anchor cloning | Non-extractable keys; BE===0 for hardwareBacked | In-profile malware / disk clone |
| Fingerprint replay | Nonce + signed binding | Fresh key + copied S-bundle |
| Anti-detect browsers | spoofScore / rebind gate | **Not solved** |
| VM farms | Match thresholds, blend floor, needsReview | Needs phase-2 product signals |

---

## Trust boundaries

- Client **never** chooses final `device_id`.
- Client `spoofScore` is advisory; server recomputes from `IntegrityReport`.
- Admin evidence GET requires `Authorization: Bearer $ADMIN_API_KEY` (no end-user login).
