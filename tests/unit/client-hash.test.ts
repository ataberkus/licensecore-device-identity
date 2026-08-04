import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  hashCollectorValue,
  hashSortedComponentHs,
  sha256Truncate128,
} from '../../packages/client/src/collect/hash.js';

describe('collect/hash', () => {
  it('truncates SHA-256 to 32 hex chars', async () => {
    const h = await sha256Truncate128('hello');
    expect(h).toMatch(/^[0-9a-f]{32}$/);
    expect(h).toBe(await sha256Truncate128('hello'));
  });

  it('canonicalJson sorts object keys', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1}}');
  });

  it('hashCollectorValue is stable for equal canonical forms', async () => {
    const a = await hashCollectorValue({ z: 1, a: [2, 3] });
    const b = await hashCollectorValue({ a: [2, 3], z: 1 });
    expect(a).toBe(b);
  });

  it('hashSortedComponentHs sorts by id', async () => {
    const h1 = await hashSortedComponentHs([
      ['webgl_gpu', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      ['audio_dsp', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
    ]);
    const h2 = await hashSortedComponentHs([
      ['audio_dsp', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      ['webgl_gpu', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    ]);
    expect(h1).toBe(h2);
  });
});
