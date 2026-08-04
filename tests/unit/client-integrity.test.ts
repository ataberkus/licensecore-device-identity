import { describe, expect, it } from 'vitest';
import { detectContradictions } from '../../packages/client/src/integrity/contradictions.js';
import { advisorySpoofScore } from '../../packages/client/src/integrity/report.js';
import { isBackupEligible } from '../../packages/client/src/anchors/tier1_webauthn.js';

describe('integrity', () => {
  it('scores advisory spoof flags', () => {
    expect(
      advisorySpoofScore({
        nativeCodeTampering: false,
        canvasNoise: false,
        audioNoise: false,
        crossSignalContradiction: false,
        automationMarkers: false,
        privacyHardening: false,
        vmMarkers: false,
      }),
    ).toBe(0);

    expect(
      advisorySpoofScore({
        nativeCodeTampering: true,
        canvasNoise: true,
        audioNoise: false,
        crossSignalContradiction: false,
        automationMarkers: true,
        privacyHardening: false,
        vmMarkers: false,
      }),
    ).toBe(25 + 15 + 30);
  });

  it('detects UA vs platform contradiction', () => {
    const r = detectContradictions({
      ua_string: { ua: 'Mozilla/5.0 (Linux; Android 13)' },
      cpu_mem: { platform: 'Win32', hardwareConcurrency: 8 },
    });
    expect(r.contradiction).toBe(true);
  });

  it('detects mobile UA with zero touch', () => {
    const r = detectContradictions({
      ua_string: { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' },
      pointer: { maxTouchPoints: 0 },
    });
    expect(r.contradiction).toBe(true);
  });
});

describe('tier1 BE gate', () => {
  it('reads BE bit from authenticatorData flags', () => {
    const data = new Uint8Array(37);
    // flags at index 32
    data[32] = 0b0000_1000; // BE
    expect(isBackupEligible(data)).toBe(true);
    data[32] = 0b0000_0101; // UP + UV, no BE
    expect(isBackupEligible(data)).toBe(false);
  });
});
