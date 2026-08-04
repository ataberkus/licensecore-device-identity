/** S2 — WebGPU adapter info when available (no permission). */
export async function collectWebgpuAdapter(): Promise<unknown> {
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) {
    throw new Error('webgpu unavailable');
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    throw new Error('no adapter');
  }

  let info: Record<string, string> | null = null;
  const anyAdapter = adapter as GPUAdapter & {
    info?: {
      vendor?: string;
      architecture?: string;
      device?: string;
      description?: string;
    };
  };
  if (anyAdapter.info) {
    const i = anyAdapter.info;
    info = {
      vendor: String(i.vendor ?? ''),
      architecture: String(i.architecture ?? ''),
      device: String(i.device ?? ''),
      description: String(i.description ?? ''),
    };
  }

  const features = [...adapter.features].sort();
  const lim = adapter.limits as unknown as Record<string, unknown>;
  const limits: Record<string, number> = {};
  for (const k of [
    'maxTextureDimension1D',
    'maxTextureDimension2D',
    'maxTextureDimension3D',
    'maxBindGroups',
    'maxBufferSize',
    'maxComputeWorkgroupSizeX',
    'maxComputeWorkgroupSizeY',
    'maxComputeWorkgroupSizeZ',
    'maxStorageBufferBindingSize',
  ]) {
    const v = lim[k];
    if (typeof v === 'number') limits[k] = v;
  }

  return { info, features, limits };
}

/** Minimal GPU typing so we do not depend on @webgpu/types. */
interface GPU {
  requestAdapter(): Promise<GPUAdapter | null>;
}
interface GPUAdapter {
  features: ReadonlySet<string>;
  limits: object;
}
