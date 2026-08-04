import { sha256Hex } from '../collect/hash.js';
import { bytesToB64Url, b64UrlToBytes } from '../util/b64url.js';

const DB_NAME = 'licensecore-device-identity';
const DB_VERSION = 1;
const STORE = 'anchors';
const KEY_RECORD = 'tier2';
const LS_THUMBPRINT = 'lc.di.t2.thumb';
const CACHE_NAME = 'lc-di-t2';
const COOKIE_NAME = 'lc_di_t2';

export interface Tier2Record {
  keyId: string;
  publicKeySpkiB64Url: string;
  createdAtMs: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('idb open'));
  });
}

function idbGet<T>(key: string): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error ?? new Error('idb get'));
        tx.oncomplete = () => db.close();
      }),
  );
}

function idbSet(key: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('idb set'));
      }),
  );
}

function idbDel(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('idb del'));
      }),
  );
}

/** Persist / read non-extractable CryptoKey + metadata in IndexedDB. */
export async function idbPutTier2(
  key: CryptoKey,
  meta: Tier2Record,
): Promise<void> {
  await idbSet(KEY_RECORD, { key, meta });
}

export async function idbGetTier2(): Promise<{
  key: CryptoKey;
  meta: Tier2Record;
} | null> {
  const row = await idbGet<{ key: CryptoKey; meta: Tier2Record }>(KEY_RECORD);
  if (!row?.key || !row.meta) return null;
  return row;
}

export async function idbClearTier2(): Promise<void> {
  await idbDel(KEY_RECORD);
}

/**
 * Mirrors store public-key thumbprint ONLY (never the private key).
 * localStorage + Cache Storage + Secure SameSite=Lax cookie.
 */
export async function mirrorThumbprint(keyId: string): Promise<void> {
  try {
    localStorage.setItem(LS_THUMBPRINT, keyId);
  } catch {
    /* private mode */
  }

  try {
    if ('caches' in globalThis) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        new Request('/__lc_di_t2_thumb'),
        new Response(keyId, {
          headers: { 'content-type': 'text/plain' },
        }),
      );
    }
  } catch {
    /* ignore */
  }

  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:';
    const parts = [
      `${COOKIE_NAME}=${encodeURIComponent(keyId)}`,
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${60 * 60 * 24 * 365 * 2}`,
    ];
    if (secure) parts.push('Secure');
    document.cookie = parts.join('; ');
  } catch {
    /* ignore */
  }
}

export async function readMirroredThumbprint(): Promise<string | null> {
  try {
    const ls = localStorage.getItem(LS_THUMBPRINT);
    if (ls) return ls;
  } catch {
    /* ignore */
  }

  try {
    if ('caches' in globalThis) {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match('/__lc_di_t2_thumb');
      if (res) return res.text();
    }
  } catch {
    /* ignore */
  }

  try {
    const m = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
    );
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch {
    /* ignore */
  }

  return null;
}

export async function clearMirrors(): Promise<void> {
  try {
    localStorage.removeItem(LS_THUMBPRINT);
  } catch {
    /* ignore */
  }
  try {
    if ('caches' in globalThis) await caches.delete(CACHE_NAME);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** SHA-256 of SPKI bytes → hex thumbprint (keyId). */
export async function thumbprintFromSpki(
  spki: ArrayBuffer,
): Promise<string> {
  return sha256Hex(spki);
}

export async function exportSpkiB64Url(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key);
  return bytesToB64Url(spki);
}

export function spkiB64UrlToBytes(b64: string): ArrayBuffer {
  const u8 = b64UrlToBytes(b64);
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

export { LS_THUMBPRINT, COOKIE_NAME, CACHE_NAME };
