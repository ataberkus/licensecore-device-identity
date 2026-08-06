# @licensecore/device-identity

Browser device identity for licensing / anti-fraud.

The client sends **evidence + a crypto anchor**. **Only the server assigns `device_id`.**

**Device = physical machine × browser profile.** Same PC, different browser → different id (by design).

| Package | Role |
|---|---|
| `@licensecore/client` | Browser SDK (&lt; 18 KB gzip, zero runtime deps) |
| `@licensecore/react` | React hook: `useDeviceIdentity` |
| `@licensecore/vue` | Vue 3 composable: `useDeviceIdentity` |
| `@licensecore/server` | Hono API (`/v1/device/*`) |
| `@licensecore/shared` | Shared Zod types |
| `apps/playground` | Local diagnostics UI (dev only) |

---

## Quick start (try it in ~30 seconds)

Needs: **Node 20+** and **pnpm**.

```bash
git clone https://github.com/ataberkus/licensecore-device-identity.git
cd licensecore-device-identity
pnpm i
pnpm dev
```

Open **https://127.0.0.1:5173** (accept the self-signed cert if prompted).

| Service | URL |
|---|---|
| Playground UI | https://127.0.0.1:5173 |
| API (direct) | http://127.0.0.1:8787 |
| API from UI | `/v1` (Vite proxies to the API) |

No `.env` needed for local play — the server uses built-in test secrets and SQLite at `data/device-identity.sqlite`.

**HTTPS matters:** Web Crypto (`crypto.subtle`) needs a secure context. Use the `https://127.0.0.1` URL, not plain `http://` on a LAN IP.

Useful follow-ups:

```bash
pnpm seed              # sample DB rows
pnpm test:unit
pnpm test:e2e          # needs: pnpm exec playwright install
pnpm size:client       # assert client gzip < 18 KB
```

---

## Pick your setup

| You want… | Go to |
|---|---|
| Drop a single `.js` into any site (no npm) | [A. Portable script](#a-portable-script-no-npm) |
| Wire into a TypeScript / Node app | [B. Packages in your app](#b-packages-in-your-app) |
| React | [C. React](#c-react) |
| Vue 3 | [D. Vue 3](#d-vue-3) |

Every path still needs the **API** running (this repo’s server or your mount of `@licensecore/server`).

---

## A. Portable script (no npm)

One file. No install. Still talk to your device-identity API.

### 1. Build the file (in this repo)

```bash
pnpm i
pnpm --filter @licensecore/shared build
pnpm --filter @licensecore/client build
```

Artifact:

```text
packages/client/dist/licensecore-client.min.js
```

### 2. Copy it into your site

```bash
# example: copy next to your HTML / static folder
cp packages/client/dist/licensecore-client.min.js /path/to/your-app/public/
```

### 3. Load and call

```html
<script src="/licensecore-client.min.js"></script>
<script type="module">
  const di = new LicenseCore.DeviceIdentityClient({
    // same-origin proxy → ''
    // otherwise → 'https://api.yourapp.com'
    baseUrl: '',
  });
  const result = await di.resolve();
  console.log(result.deviceId, result.deviceToken);
</script>
```

Or one-shot helpers:

```html
<script src="/licensecore-client.min.js"></script>
<script type="module">
  const result = await LicenseCore.resolve({ baseUrl: '' });
</script>
```

Global: `LicenseCore` — `DeviceIdentityClient`, `resolve`, `collect`, `reverify`, `wipeAnchors`, `wipeLocalState`, …

Smoke page in this repo: [examples/portable/index.html](./examples/portable/index.html)

### CDN (after you tag a release)

```bash
git tag v0.1.0
git push origin v0.1.0
# CI uploads licensecore-client.min.js to the GitHub Release
```

```html
<script src="https://cdn.jsdelivr.net/gh/ataberkus/licensecore-device-identity@v0.1.0/packages/client/dist/licensecore-client.min.js"></script>
```

Pin the tag in production.

---

## B. Packages in your app

Packages are **`private: true`** (not on public npm yet). Depend via `workspace:`, `file:`, or git submodule.

### 1. Build this repo once

```bash
cd /path/to/licensecore-device-identity
pnpm i
pnpm --filter @licensecore/shared build
pnpm --filter @licensecore/client build
# optional wrappers:
pnpm --filter @licensecore/react build
pnpm --filter @licensecore/vue build
# or everything:
pnpm build
```

### 2. Add dependencies in your app

**Same pnpm workspace:**

```json
{
  "dependencies": {
    "@licensecore/client": "workspace:*",
    "@licensecore/server": "workspace:*",
    "@licensecore/shared": "workspace:*"
  }
}
```

**Separate repo (relative path):**

```json
{
  "dependencies": {
    "@licensecore/client": "file:../licensecore-device-identity/packages/client",
    "@licensecore/server": "file:../licensecore-device-identity/packages/server",
    "@licensecore/shared": "file:../licensecore-device-identity/packages/shared"
  }
}
```

Then:

```bash
pnpm i
```

### 3. Run / mount the API

Minimal Node server:

```ts
// server.ts
import { serve } from '@hono/node-server';
import { createApp, loadEnv } from '@licensecore/server';

const env = loadEnv(); // see .env.example
const app = createApp({ env });

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) });
```

```bash
# from this repo, API only:
pnpm dev:server
# → http://127.0.0.1:8787
```

**Postgres** (async open):

```ts
import { createAppAsync, loadEnv } from '@licensecore/server';
const app = await createAppAsync({ env: loadEnv() });
```

Copy env template:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs `deviceToken` (~10 min TTL) |
| `IP_PEPPER` | HMAC for hashed IPs |
| `ADMIN_API_KEY` | Bearer for admin evidence API |
| `DATABASE_DIALECT` | `sqlite` (default) or `postgres` |
| `DATABASE_URL` | e.g. `file:./data/device-identity.sqlite` |
| `WEBAUTHN_RP_ID` | Optional; Tier 1 WebAuthn |

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/device/challenge` | One-time nonce |
| `POST` | `/v1/device/resolve` | Enroll / recognize / rebind |
| `POST` | `/v1/device/reverify` | Refresh `deviceToken` |
| `GET` | `/v1/device/:id/evidence` | Admin evidence history |

Serve same-origin (proxy `/v1`) or enable CORS for your app origin.

### 4. Call from the browser (plain TS)

```ts
import { DeviceIdentityClient } from '@licensecore/client';

const di = new DeviceIdentityClient({
  baseUrl: '', // same-origin proxy, or 'https://api.yourapp.com'
});

const result = await di.resolve();
localStorage.setItem('deviceId', result.deviceId);
sessionStorage.setItem('deviceToken', result.deviceToken);
```

Refresh near JWT expiry:

```ts
const { deviceToken } = await di.reverify();
sessionStorage.setItem('deviceToken', deviceToken);
```

Vite proxy so `baseUrl: ''` works in dev:

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

Also available: `collect()`, `resolve()`, `reverify()`, `wipeLocalState()`, `wipeAnchors()`.

---

## C. React

```bash
# in this monorepo / after file: dep
pnpm --filter @licensecore/react build
```

```tsx
import { useDeviceIdentity } from '@licensecore/react';

function App() {
  // autoResolve defaults to true
  const { status, deviceId, error, reverify, resolve } = useDeviceIdentity({
    baseUrl: '',
  });

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

// Imperative only: useDeviceIdentity({ baseUrl: '', autoResolve: false })
```

Add to your app:

```json
{ "dependencies": { "@licensecore/react": "workspace:*" } }
```

---

## D. Vue 3

```bash
pnpm --filter @licensecore/vue build
```

```vue
<script setup lang="ts">
import { useDeviceIdentity } from '@licensecore/vue';

const { status, deviceId, error, reverify, resolve } = useDeviceIdentity({
  baseUrl: '',
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

```json
{ "dependencies": { "@licensecore/vue": "workspace:*" } }
```

---

## Product wiring (your app)

This repo does **not** implement licenses or seats. After `resolve()`:

```ts
const { deviceId, confidence, spoofScore, needsReview, deviceToken } =
  await di.resolve();

fetch('/api/license/activate', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${userSession}`,
    'X-Device-Token': deviceToken,
  },
  body: JSON.stringify({ deviceId }),
});
```

```text
App boot  →  resolve()  →  store deviceId + deviceToken
API calls →  send deviceToken; reverify() when expired
Site data wiped → resolve() again (rebind may keep same deviceId)
New browser profile → new deviceId
```

**Do not:** invent a client-side `device_id`; treat a raw fingerprint as a login; expect the same id across Chrome and Firefox; claim MAC / serial / CPU / disk IDs.

---

## What this can and cannot do

### Can

- Durable id via anchors (optional WebAuthn, else non-extractable ECDSA in IndexedDB) + CLASS S signals for rebind
- Server `confidence` + `spoofScore`
- Survive cookie/localStorage clears when Tier 2 IDB remains; rebind after full wipe when gates pass
- Collection budget ~400 ms; client ESM gzip &lt; 18 KB

### Cannot

- Read hardware serials / MACs / CPU / disk IDs
- Merge two browser profiles into one device
- Alone defeat a determined anti-detect browser ([THREAT_MODEL.md](./THREAT_MODEL.md))
- Replace seat / license / payment enforcement

### Confidence (server)

| Confidence | Typical path |
|---|---|
| `high` | Recognize Tier 1/2; enroll Tier 1 with `hardwareBacked` |
| `medium` | Tier 1/2 enroll without hardware-backed; rebind |
| `low` | Tier 3 evidence-only, or ambiguous multi-candidate enroll |

`hardwareBacked: true` only when Tier 1 and authenticator **BE === 0** (non-syncable).

---

## Docs

| Doc | Contents |
|---|---|
| [THREAT_MODEL.md](./THREAT_MODEL.md) | Attackers, controls, residual risk |
| [SIGNALS.md](./SIGNALS.md) | Collectors, weights, instability |
| [ADR/DECISIONS.md](./ADR/DECISIONS.md) | Anchors, hashing, BE gate, rebind |
| [tests/e2e/LIMITATIONS.md](./tests/e2e/LIMITATIONS.md) | Engine gaps |

## Dependencies

Client bundle: **MIT**, **zero** npm runtime deps. Server: MIT/Apache-2.0 only (`hono`, `drizzle-orm`, `jose`, …). **No FingerprintJS / BSL** SDKs.
