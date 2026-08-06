import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import {
  DeviceIdentityClient,
  type CollectOptions,
  type DeviceIdentityClientOptions,
  type ResolveFlowOptions,
  type ReverifyFlowOptions,
} from '@licensecore/client';
import type {
  EvidenceBundle,
  ResolveResponse,
  ReverifyResponse,
} from '@licensecore/client';

export type DeviceIdentityStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseDeviceIdentityOptions extends DeviceIdentityClientOptions {
  /** When true (default), call resolve() once on mount. */
  autoResolve?: boolean;
}

function clientOptsFrom(
  options: UseDeviceIdentityOptions,
): DeviceIdentityClientOptions {
  const { autoResolve: _auto, ...rest } = options;
  return rest;
}

export function useDeviceIdentity(options: UseDeviceIdentityOptions = {}) {
  const autoResolve = options.autoResolve !== false;
  const client = new DeviceIdentityClient(clientOptsFrom(options));

  const status = ref<DeviceIdentityStatus>(autoResolve ? 'loading' : 'idle');
  const result = shallowRef<ResolveResponse | null>(null);
  const error = shallowRef<unknown>(null);
  let alive = true;

  onUnmounted(() => {
    alive = false;
  });

  async function resolve(
    resolveOptions?: Omit<
      ResolveFlowOptions,
      keyof DeviceIdentityClientOptions
    >,
  ): Promise<ResolveResponse> {
    status.value = 'loading';
    error.value = null;
    try {
      const next = await client.resolve(resolveOptions);
      if (alive) {
        result.value = next;
        status.value = 'ready';
      }
      return next;
    } catch (err) {
      if (alive) {
        error.value = err;
        status.value = 'error';
      }
      throw err;
    }
  }

  async function reverify(
    reverifyOptions?: Omit<
      ReverifyFlowOptions,
      keyof DeviceIdentityClientOptions
    >,
  ): Promise<ReverifyResponse> {
    status.value = 'loading';
    error.value = null;
    try {
      const next = await client.reverify(reverifyOptions);
      if (alive) {
        if (result.value) {
          result.value = {
            ...result.value,
            deviceId: next.deviceId,
            deviceToken: next.deviceToken,
          };
        }
        status.value = 'ready';
      }
      return next;
    } catch (err) {
      if (alive) {
        error.value = err;
        status.value = 'error';
      }
      throw err;
    }
  }

  function collect(collectOptions?: CollectOptions): Promise<EvidenceBundle> {
    return client.collect(collectOptions);
  }

  function wipeAnchors(): Promise<void> {
    return client.wipeAnchors();
  }

  function wipeLocalState(): Promise<void> {
    return client.wipeLocalState();
  }

  onMounted(() => {
    if (!autoResolve) return;
    void resolve().catch(() => {
      /* status/error already set */
    });
  });

  const deviceId = computed(() => result.value?.deviceId ?? null);
  const deviceToken = computed(() => result.value?.deviceToken ?? null);

  return {
    status,
    result,
    error,
    deviceId,
    deviceToken,
    resolve,
    reverify,
    collect,
    wipeAnchors,
    wipeLocalState,
  };
}
