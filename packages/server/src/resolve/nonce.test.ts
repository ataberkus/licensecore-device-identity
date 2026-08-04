import { describe, expect, it } from 'vitest';
import { NonceStore } from '../resolve/nonce.js';

describe('NonceStore', () => {
  it('issues origin-bound 32-byte hex nonce with 60s TTL', () => {
    const store = new NonceStore();
    const now = 1_700_000_000_000;
    const issued = store.issue('https://app.example', now);
    expect(issued.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.expiresAt).toBe(now + 60_000);
    expect(issued.serverTimeMs).toBe(now);
  });

  it('burns nonce on successful consume', () => {
    const store = new NonceStore();
    const now = 1_700_000_000_000;
    const { nonce } = store.issue('https://app.example', now);
    const first = store.consume(nonce, 'https://app.example', now + 1000);
    expect(first.ok).toBe(true);
    const second = store.consume(nonce, 'https://app.example', now + 2000);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('NONCE_REPLAY');
  });

  it('rejects replay and marks used', () => {
    const store = new NonceStore();
    const now = 1_700_000_000_000;
    const { nonce } = store.issue('https://app.example', now);
    store.consume(nonce, 'https://app.example', now);
    const again = store.consume(nonce, 'https://app.example', now + 1);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('NONCE_REPLAY');
  });

  it('rejects expired and burns', () => {
    const store = new NonceStore();
    const now = 1_700_000_000_000;
    const { nonce } = store.issue('https://app.example', now);
    const expired = store.consume(nonce, 'https://app.example', now + 61_000);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error.code).toBe('NONCE_EXPIRED');
    const again = store.consume(nonce, 'https://app.example', now + 62_000);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('NONCE_REPLAY');
  });

  it('rejects origin mismatch and burns', () => {
    const store = new NonceStore();
    const now = 1_700_000_000_000;
    const { nonce } = store.issue('https://app.example', now);
    const bad = store.consume(nonce, 'https://evil.example', now + 1);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('ORIGIN_MISMATCH');
  });

  it('rejects unknown nonce', () => {
    const store = new NonceStore();
    const bad = store.consume('ab'.repeat(32), 'https://app.example');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('NONCE_INVALID');
  });
});
