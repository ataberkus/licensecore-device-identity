# E2E acceptance limitations

Honest gaps from the T1–T16 Playwright matrix (Chromium / Firefox / WebKit). Tests are **not** weakened to hide these.

| ID | Engine | Result / limitation |
|---|---|---|
| T11 | Firefox, WebKit | **Skipped** — `userAgentData` / `fullVersionList` are Chromium-only. S7 already excludes those fields from the stable hash. |
| T13 | Cross-project | Firefox RFP case runs only under `firefox`; WebKit stability only under `webkit` (other project entries skip). |
| T14 | All | Distinct `deviceId` asserted. `privateContext` is best-effort — may be absent (documented residual). |
| T15 p95 | Firefox, WebKit | **FAIL** — collection wall-clock p95 ≈ 280–375ms here (still under **400ms** hard budget). Chromium **PASS** p95 &lt; 150ms. Gzip &lt; 18KB **PASS** on all via `pnpm size:client`. |

## Product fixes landed while implementing the matrix

- ECDSA: server verifies with `verify('sha256', message, { dsaEncoding: 'ieee-p1363' })` (WebCrypto-compatible).
- `REBIND_MIN_IDLE_MS` (3s): concurrent profiles (T5/T14) enroll separately; wipe recovery (T4) waits past the idle window.
- Soft GPU strings (`swiftshader`, `llvmpipe`) are advisory only.
- Timing / storage collectors quantized to keep `stableHash` prefix usable for rebind.
- Default ASN `64512` when upstream ASN is absent (localhost candidate search).

## Re-run

```bash
pnpm exec playwright install
pnpm --filter @licensecore/shared build
pnpm test:e2e
pnpm test:e2e -- --project=chromium
```
