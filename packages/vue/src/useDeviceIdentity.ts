import {
  computed,
  onUnmounted,
  ref,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
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
  /** When true (default), call resolve() on setup / when client options change. */
  autoResolve?: boolean;
}

function clientOptsFrom(
  options: UseDeviceIdentityOptions,
): DeviceIdentityClientOptions {
  const { autoResolve: _auto, ...rest } = options;
  return rest;
}

/**
 * @param options Plain object, ref, or getter. Use a getter/computed when
 * `baseUrl` (etc.) should stay reactive, e.g. `() => ({ baseUrl: url.value })`.
 */
export function useDeviceIdentity(
  options: MaybeRefOrGetter<UseDeviceIdentityOptions> = {},
) {
  const readOptions = (): UseDeviceIdentityOptions => toValue(options);
  const readClientOpts = (): DeviceIdentityClientOptions =>
    clientOptsFrom(readOptions());

  const client = shallowRef(new DeviceIdentityClient(readClientOpts()));
  const status = ref<DeviceIdentityStatus>(
    readOptions().autoResolve !== false ? 'loading' : 'idle',
  );
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
    if (alive) {
      status.value = 'loading';
      error.value = null;
    }
    try {
      const next = await client.value.resolve(resolveOptions);
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
    if (alive) {
      status.value = 'loading';
      error.value = null;
    }
    try {
      const next = await client.value.reverify(reverifyOptions);
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
    return client.value.collect(collectOptions);
  }

  function wipeAnchors(): Promise<void> {
    return client.value.wipeAnchors();
  }

  function wipeLocalState(): Promise<void> {
    return client.value.wipeLocalState();
  }

  watch(
    () => {
      const o = readOptions();
      return {
        autoResolve: o.autoResolve !== false,
        baseUrl: o.baseUrl,
        profile: o.profile,
        enrollHardwareAnchor: o.enrollHardwareAnchor,
        fetch: o.fetch,
      } as const;
    },
    (curr) => {
      client.value = new DeviceIdentityClient(readClientOpts());
      if (!curr.autoResolve) return;
      void resolve().catch(() => {
        /* status/error already set */
      });
    },
    { immediate: true },
  );

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
