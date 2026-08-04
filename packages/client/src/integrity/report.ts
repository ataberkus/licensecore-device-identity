import type { IntegrityReport } from '@licensecore/shared';
import { detectAutomation } from './automation.js';
import { detectContradictions } from './contradictions.js';
import { detectNativeCodeTampering } from './native-code.js';
import { detectAudioNoise, detectCanvasNoise } from './noise.js';
import { detectPrivacyHardening } from './privacy.js';
import { detectVmMarkers } from './vm.js';

/** Advisory spoofScore weights (server recomputes authority). */
const WEIGHTS = {
  nativeCodeTampering: 25,
  canvasNoise: 15,
  audioNoise: 15,
  crossSignalContradiction: 20,
  automationMarkers: 30,
  privacyHardening: 10,
  vmMarkers: 10,
} as const;

export interface BuildIntegrityOptions {
  /** Successful collector raw values keyed by CollectorId. */
  raw: Readonly<Record<string, unknown>>;
  /** Skip slow audio double-render when budget is tight. */
  skipAudioNoise?: boolean;
}

export async function buildIntegrityReport(
  opts: BuildIntegrityOptions,
): Promise<IntegrityReport> {
  const native = safe(() => detectNativeCodeTampering(), {
    tampered: false,
    details: {},
  });
  const canvas = safe(() => detectCanvasNoise(), {
    noise: false,
    details: {},
  });
  const audio = opts.skipAudioNoise
    ? { noise: false, details: { skipped: true } }
    : await safeAsync(() => detectAudioNoise(), {
        noise: false,
        details: {},
      });
  const contra = detectContradictions(opts.raw);
  const auto = safe(() => detectAutomation(), {
    automation: false,
    details: {},
  });
  const privacy = detectPrivacyHardening(opts.raw);
  const vm = detectVmMarkers(opts.raw);

  const nativeCodeTampering = native.tampered;
  const canvasNoise = canvas.noise;
  const audioNoise = audio.noise;
  const crossSignalContradiction = contra.contradiction;
  const automationMarkers = auto.automation;
  const privacyHardening = privacy.hardening;
  const vmMarkers = vm.vm;

  let spoofScore = 0;
  if (nativeCodeTampering) spoofScore += WEIGHTS.nativeCodeTampering;
  if (canvasNoise) spoofScore += WEIGHTS.canvasNoise;
  if (audioNoise) spoofScore += WEIGHTS.audioNoise;
  if (crossSignalContradiction) spoofScore += WEIGHTS.crossSignalContradiction;
  if (automationMarkers) spoofScore += WEIGHTS.automationMarkers;
  if (privacyHardening) spoofScore += WEIGHTS.privacyHardening;
  if (vmMarkers) spoofScore += WEIGHTS.vmMarkers;
  if (spoofScore > 100) spoofScore = 100;

  return {
    nativeCodeTampering,
    canvasNoise,
    audioNoise,
    crossSignalContradiction,
    automationMarkers,
    privacyHardening,
    vmMarkers,
    spoofScore,
    details: {
      native: native.details,
      canvas: canvas.details,
      audio: audio.details,
      contradictions: contra.details,
      automation: auto.details,
      privacy: privacy.details,
      vm: vm.details,
    },
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

async function safeAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/** Pure score helper for unit tests. */
export function advisorySpoofScore(flags: {
  nativeCodeTampering: boolean;
  canvasNoise: boolean;
  audioNoise: boolean;
  crossSignalContradiction: boolean;
  automationMarkers: boolean;
  privacyHardening: boolean;
  vmMarkers: boolean;
}): number {
  let s = 0;
  if (flags.nativeCodeTampering) s += WEIGHTS.nativeCodeTampering;
  if (flags.canvasNoise) s += WEIGHTS.canvasNoise;
  if (flags.audioNoise) s += WEIGHTS.audioNoise;
  if (flags.crossSignalContradiction) s += WEIGHTS.crossSignalContradiction;
  if (flags.automationMarkers) s += WEIGHTS.automationMarkers;
  if (flags.privacyHardening) s += WEIGHTS.privacyHardening;
  if (flags.vmMarkers) s += WEIGHTS.vmMarkers;
  return s > 100 ? 100 : s;
}
