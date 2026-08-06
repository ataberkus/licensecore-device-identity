# Signals — collectors

Source of truth: `packages/client/src/collect/collectors/*`, weights in `packages/shared/src/constants/weights.ts`, timeouts in `packages/client/src/collect/collectors/index.ts`.

**Evidence profiles** (`packages/shared/src/constants/collectors.ts`)

| Profile | Default | Collectors |
|---------|---------|------------|
| `stable` | **yes** | All CLASS-S except `font_metrics`; no CLASS-V |
| `full` | opt-in | Every registered S + V collector (including `font_metrics`) |

`componentHashes` is a **partial** map: only keys for the selected profile are present (no synthetic `error` padding for skipped collectors). Server matching is **same-profile only**; legacy DB rows without `profile` are treated as `full`.

**Classes**

- **S (stable):** enters `stableHash` and weighted match / rebind / drift. `error: true` excluded from score numerator and denominator.
- **V (volatile):** enters `volatileHash` only — ignored for identity match (resize, language, UA string bumps, etc.). Absent under the `stable` profile.

**Hashing:** each collector value → canonical JSON → SHA-256 truncated to **128-bit hex** (`h`). Aggregates = sorted `id=h` lines → same truncate.

**Budget:** runner hard stop **400ms**; per-collector `timeoutMs`; S14 timing loop capped at **25ms**. Failures are isolated (`error: true`).

**Permissions:** no geolocation, camera, `queryLocalFonts()`, notifications, or `getUserMedia`.

---

## CLASS S (weights sum = 1.0)

| ID | Weight | Timeout | What is collected | Why | Known instability |
|---|---:|---:|---|---|---|
| `webgl_gpu` | 0.13 | 50ms | Unmasked WebGL vendor/renderer (+ version, shading, context attrs) | Strong GPU/driver string entropy | Driver/OS updates; privacy unmasking disabled; headless/WebGL block → error |
| `webgpu_adapter` | 0.10 | 80ms | Adapter info, sorted features, selected limits | Modern GPU identity when available | Missing WebGPU; adapter deny; browser updates change features/limits |
| `canvas_render` | 0.11 | 40ms | Fixed 2D scene → `toDataURL` | Raster/font subpixel fingerprint | Canvas noise extensions; RFP/fingerprinting resistance; GPU switch |
| `webgl_render` | 0.09 | 50ms | Triangle draw → `readPixels` sum/sample + dataURL | GPU pipeline fingerprint orthogonal to strings | Same as WebGL block/noise; antialias/driver diffs |
| `audio_dsp` | 0.09 | 80ms | OfflineAudioContext oscillator→compressor samples | Audio stack fingerprint | Autoplay/audio privacy noise; OfflineAudio unavailable; sample drift under load |
| `cpu_mem` | 0.06 | 20ms | `hardwareConcurrency`, `deviceMemory`, `platform` | Coarse machine class | VM CPU changes; Firefox may omit `deviceMemory` |
| `ua_ch_high` | 0.09 | 50ms | UA-CH brands/mobile/platform + high-entropy **architecture, bitness, model, platformVersion, formFactors, wow64** — **excludes** `fullVersionList` / full UA version | Stable client platform without patch-level churn (T11) | No `userAgentData` (Firefox/Safari) → degraded payload; platformVersion OS bumps |
| `display` | 0.05 | 20ms | Screen width/height/avail, color/pixel depth, `devicePixelRatio`, orientation | Monitor configuration | External monitor plug; DPI/zoom affecting DPR; orientation |
| `media_hw_decode` | 0.06 | 40ms | `canPlayType` / MSE `isTypeSupported` for fixed codec list | Codec capability set | Browser codec pack changes; OS media components |
| `font_metrics` | 0.09 | 60ms | `measureText` widths for a fixed font list vs monospace baseline (**no** `queryLocalFonts`) | Installed-font proxy without permission prompts — **full profile only** | Font install/uninstall; emoji font diffs; canvas privacy |
| `math_fp` | 0.05 | 20ms | Fixed transcendental/`Math.*` probe set | JS engine / libc math fingerprint | Engine version upgrades |
| `storage_quota` | 0.04 | 50ms | `navigator.storage.estimate()` quota/usage + `persisted()` | Origin storage policy / disk pressure proxy | Quota changes with free disk; private mode differences |
| `timing_profile` | 0.04 | 25ms | Micro-benchmark ops/median/p90 within **25ms** wall cap | Scheduler / CPU speed hint | Thermal throttle, CPU contention, DevTools throttling — noisy by nature |

---

## CLASS V (not used in match)

Present only under the `full` profile.

| ID | Timeout | What is collected | Why (diagnostics / volatileHash) | Known instability |
|---|---:|---|---|---|
| `ua_string` | 10ms | `navigator.userAgent` | Full UA string changes often | Browser / spoof updates |
| `languages` | 10ms | `language` + `languages` | Locale preference | User language changes |
| `timezone` | 10ms | IANA TZ + offset minutes | Travel / DST / preference | Travel, DST, manual TZ |
| `network` | 15ms | Network Information API if present | Connectivity class | EffectiveType/rtt churn |
| `prefs` | 10ms | cookieEnabled, DNT, pdfViewer, webdriver, maxTouchPoints | Preference / automation hints | Pref toggles; webdriver in automation |
| `pointer` | 10ms | pointer/hover media queries + maxTouchPoints | Input modality | Docked tablet, remote desktop |
| `plugins` | 15ms | Plugin names/counts + mimeTypes length | Legacy plugin surface | Chromium often empty; plugin list churn |

---

## Integrity (not collectors, affects spoofScore)

Built after collection (`packages/client/src/integrity/*`). Server recomputes score from flags (`packages/server/src/resolve/spoof.ts`):

| Flag | Approx. points |
|---|---:|
| `nativeCodeTampering` | +35 |
| `automationMarkers` | +30 |
| `crossSignalContradiction` | +25 |
| `vmMarkers` | +20 |
| `canvasNoise` / `audioNoise` | +15 each |
| `privacyHardening` | +10 |

Rebind blocked at **spoofScore ≥ 40**.
