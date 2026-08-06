# @licensecore/device-identity

Browser device identity for licensing / anti-fraud. The client sends **evidence + a crypto anchor**; **only the server assigns `device_id`**.

| Package | Role |
|---|---|
| `@licensecore/client` | Browser SDK (zero runtime deps, &lt; 18 KB gzip) |
| `@licensecore/react` | React hook (`useDeviceIdentity`) |
| `@licensecore/vue` | Vue 3 composable (`useDeviceIdentity`) |
| `@licensecore/server` | Hono API: challenge / resolve / reverify |
| `@licensecore/shared` | Zod wire types (import on both sides) |
| `apps/playground` | Diagnostics UI only — not required in production |

**Device = physical machine × browser profile.** Cross-browser identity is not a goal.

---

## Portable (no install)

Use the browser SDK **without npm** — copy a single file or load it from a CDN after a release tag.

Build the portable artifact:

```bash
pnpm --filter @licensecore/shared build
pnpm --filter @licensecore/client build
```

Output: `packages/client/dist/licensecore-client.min.js` (IIFE, zero runtime deps, &lt; 18 KB gzip).

### Vendor (recommended)

Copy `licensecore-client.min.js` into your app and load it:

```html
<script src="/static/licensecore-client.min.js"></script>
<script>
  const di = new LicenseCore.DeviceIdentityClient({
    baseUrl: '', // same-origin proxy to your API, or full URL
  });
  const result = await di.resolve();
</script>
```

Global API on `LicenseCore`: `DeviceIdentityClient`, `resolve`, `collect`, `reverify`, `wipeAnchors`, `wipeLocalState`, and transport helpers exported from the SDK.

One-shot helpers without the class:

```html
<script>
  const evidence = await LicenseCore.collect();
  const result = await LicenseCore.resolve({ baseUrl: '' });
</script>
```

You still need the device-identity **API** mounted on your backend (see below). Serve over **HTTPS** — browsers require a secure context for Web Crypto.

Smoke example: [examples/portable/index.html](./examples/portable/index.html).

### CDN (GitHub release)

After pushing a version tag (e.g. `v0.1.0`), CI attaches `licensecore-client.min.js` to the GitHub Release. Load via jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/gh/ataberkus/licensecore-device-identity@v0.1.0/packages/client/dist/licensecore-client.min.js"></script>
```

Replace `v0.1.0` with your tag. Pin the version in production.

---

## Use in another app

Packages are workspace-local (`private: true`). Point your app at this repo via `workspace:` / `file:` / git submodule — do not expect a public npm publish yet.

### 1. Depend on the packages

From your app’s `package.json` (pnpm example):

```json
{
  "dependencies": {
    "@licensecore/client": "workspace:*",
    "@licensecore/react": "workspace:*",
    "@licensecore/vue": "workspace:*",
    "@licensecore/server": "workspace:*",
    "@licensecore/shared": "workspace:*"
  }
}
```

Or with a relative path:

```json
{
  "dependencies": {
    "@licensecore/client": "file:../hwid/packages/client",
    "@licensecore/server": "file:../hwid/packages/server",
    "@licensecore/shared": "file:../hwid/packages/shared"
  }
}
```

Build once so the client (and framework wrappers) ship `dist/`:

```bash
pnpm --filter @licensecore/shared build
pnpm --filter @licensecore/client build
pnpm --filter @licensecore/react build
pnpm --filter @licensecore/vue build
```

### 2. Mount the API on your backend

The server is a **Hono app**. Mount it on Node, Bun, or any Hono-compatible runtime.

```ts
// server.ts (Node example)
import { serve } from '@hono/node-server';
import { createApp, loadEnv } from '@licensecore/server';

const env = loadEnv(); // reads process.env — see .env.example
const app = createApp({ env });

// Optional: mount under your existing app
// yourApp.route('/device', app)

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) });
```

**Postgres** (migrations need async open):

```ts
import { createAppAsync, loadEnv } from '@licensecore/server';

const app = await createAppAsync({ env: loadEnv() });
```

**Required env** (production):

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs `deviceToken` (10 min TTL) |
| `IP_PEPPER` | HMAC for hashed IPs (never store raw IP) |
| `ADMIN_API_KEY` | Bearer for `GET /v1/device/:id/evidence` |
| `DATABASE_DIALECT` | `sqlite` (default) or `postgres` |
| `DATABASE_URL` | e.g. `file:./data/device-identity.sqlite` or Postgres URL |
| `WEBAUTHN_RP_ID` | Optional; for Tier 1 WebAuthn |

Endpoints your frontend will call:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/device/challenge` | One-time nonce (60s, origin-bound) |
| `POST` | `/v1/device/resolve` | Enroll / recognize / rebind → `deviceId` |
| `POST` | `/v1/device/reverify` | Refresh `deviceToken` |
| `GET` | `/v1/device/:id/evidence` | Admin evidence history |

CORS: serve the API same-origin (proxy `/v1`) or allow your app’s origin. The resolve path binds the browser **origin** into the nonce and signature.

### 3. Call from your frontend

```ts
import { DeviceIdentityClient } from '@licensecore/client';

const di = new DeviceIdentityClient({
  // Same-origin via Vite/nginx proxy → use ''
  // Cross-origin API → use full base URL
  baseUrl: '', // or 'https://api.yourapp.com'
});

async function bootDeviceIdentity() {
  const result = await di.resolve();
  // Persist for your product (license seat, session binding, etc.)
  localStorage.setItem('deviceId', result.deviceId);
  sessionStorage.setItem('deviceToken', result.deviceToken);

  return result;
  // result.deviceId       — server-owned UUIDv7
  // result.isNew          — first time this anchor enrolled
  // result.confidence     — 'high' | 'medium' | 'low'
  // result.anchorTier     — 1 | 2 | 3
  // result.hardwareBacked — true only for non-syncable WebAuthn (BE=0)
  // result.rebound        — true after wipe + fingerprint rebind
  // result.spoofScore     — server-authoritative 0..100
  // result.needsReview?   — ambiguous candidates
  // result.privateContext? — incognito-style heuristic
}

// Cheap refresh when the JWT is near expiry (~10 min)
async function refreshDeviceToken() {
  const { deviceToken, deviceId, expiresAt } = await di.reverify();
  sessionStorage.setItem('deviceToken', deviceToken);
  return { deviceToken, deviceId, expiresAt };
}

// Optional: platform authenticator (may prompt the user)
await di.resolve({ enrollHardwareAnchor: true });
```

One-shot helpers (same package): `collect()`, `resolve()`, `reverify()`, `wipeLocalState()`, `wipeAnchors()`.

#### React (`@licensecore/react`)

```tsx
import { useDeviceIdentity } from '@licensecore/react';

function App() {
  // autoResolve defaults to true — resolve() runs once on mount
  const { status, deviceId, deviceToken, error, reverify, resolve } =
    useDeviceIdentity({ baseUrl: '' });

  if (status === 'loading') return <p>Resolving device…</p>;
  if (status === 'error') return <p>{String(error)}</p>;

  return (
    <div>
      <p>deviceId: {deviceId}</p>
      <button type="button" onClick={() => void reverify()}>
        Refresh token
      </button>
      <button type="button" onClick={() => void resolve()}>
        Resolve again
      </button>
    </div>
  );
}

// Imperative only:
// useDeviceIdentity({ baseUrl: '', autoResolve: false })
```

#### Vue 3 (`@licensecore/vue`)

```vue
<script setup lang="ts">
import { useDeviceIdentity } from '@licensecore/vue';

const { status, deviceId, error, reverify, resolve } = useDeviceIdentity({
  baseUrl: '',
  // autoResolve: false, // opt out of mount-time resolve
});
</script>

<template>
  <p v-if="status === 'loading'">Resolving device…</p>
  <p v-else-if="status === 'error'">{{ error }}</p>
  <div v-else>
    <p>deviceId: {{ deviceId }}</p>
    <button type="button" @click="reverify()">Refresh token</button>
    <button type="button" @click="resolve()">Resolve again</button>
  </div>
</template>
```

**Vite proxy example** (so `baseUrl: ''` works in dev):

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/v1': 'http://127.0.0.1:8787',
      '/health': 'http://127.0.0.1:8787',
    },
  },
});
```

### 4. Wire it into your product logic

This repo does **not** implement licenses or seats. In your app:

```ts
const { deviceId, confidence, spoofScore, needsReview, deviceToken } =
  await di.resolve();

// Send deviceToken (or deviceId) on authenticated API calls
fetch('/api/license/activate', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${userSession}`,
    'X-Device-Token': deviceToken,
  },
  body: JSON.stringify({ deviceId }),
});

// Policy tips
// - confidence === 'low' or needsReview → require extra checks / manual review
// - spoofScore >= 40 → treat as hostile for rebind-sensitive actions
// - same machine, new browser profile → new deviceId (by design)
```

Typical lifecycle:

```text
App boot  →  resolve()  →  store deviceId + deviceToken
API calls →  send deviceToken; reverify() when expired
User clears site data  →  resolve() again
                       →  same deviceId if rebind succeeds (rebound: true)
New browser profile    →  new deviceId
```

### 5. What you must not do

- Do **not** invent a client-side `device_id` hash and trust it.
- Do **not** treat a raw fingerprint as a login credential — possession of the non-extractable anchor key is the proof.
- Do **not** expect the same id across Chrome and Firefox on one PC.
- Do **not** claim MAC / serial / CPU / disk IDs — browsers do not expose them.

---

## Local playground (this repo)

```bash
pnpm i
pnpm dev
```

- Playground: **https://127.0.0.1:5173** (HTTPS — required for `crypto.subtle`)
- API: http://127.0.0.1:8787 (proxied via `/v1` from the playground)
- On another device on your LAN: use the **https://** Network URL Vite prints (accept the self-signed cert warning). Plain `http://192.168.x.x` will fail — browsers block Web Crypto off localhost.  

Without env vars, the server uses built-in test secrets and SQLite at `data/device-identity.sqlite`.

```bash
pnpm seed              # sample rows
pnpm test:unit
pnpm test:e2e          # Playwright T1–T16
pnpm size:client       # assert client gzip < 18KB
pnpm bench:collectors  # needs: pnpm exec playwright install chromium
```

---

## What this can and cannot do

### Can

- Bind a durable id with **anchors** (optional WebAuthn platform key, else non-extractable ECDSA in IndexedDB) plus **CLASS S** signals for rebind after storage wipe.
- Report **confidence** and server **spoofScore**.
- Survive cookie/localStorage clears when the Tier 2 IDB key remains (**recognize**). After full site-data wipe, **rebind** when fingerprint + server blend pass gates.
- Stay under a **400ms** collection hard budget; client ESM gzip **&lt; 18 KB**.

### Cannot

- Read real hardware serials, MACs, CPU IDs, or disk IDs.
- Merge two browser profiles on one machine into one device.
- Defeat a determined anti-detect browser alone (see [THREAT_MODEL.md](./THREAT_MODEL.md)).
- Replace seat / license / payment enforcement — that is your product’s job.

### Confidence (server)

| Confidence | Typical path |
|---|---|
| `high` | Recognize Tier 1/2; enroll Tier 1 with `hardwareBacked` |
| `medium` | Tier 1/2 enroll without hardware-backed; rebind |
| `low` | Tier 3 evidence-only, or ambiguous multi-candidate enroll |

`hardwareBacked: true` only when Tier 1 and authenticator **BE === 0** (non-syncable). Syncable passkeys fall through to Tier 2.

---

## Docs

| Doc | Contents |
|---|---|
| [THREAT_MODEL.md](./THREAT_MODEL.md) | Attacker goals, controls, residual risk |
| [SIGNALS.md](./SIGNALS.md) | Collectors, S/V class, weights, instability |
| [ADR/DECISIONS.md](./ADR/DECISIONS.md) | Anchors vs fingerprints, hashing, BE gate, rebind |
| [tests/e2e/LIMITATIONS.md](./tests/e2e/LIMITATIONS.md) | Honest engine gaps (e.g. Firefox/WebKit T15 p95) |

## Dependencies

Client published bundle: **MIT**, **zero** npm runtime dependencies. Server: MIT/Apache-2.0 only (`hono`, `drizzle-orm`, `jose`, `@simplewebauthn/server`, …). **No FingerprintJS / BSL** fingerprint SDKs.
