import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** When true (default), call resolve() once on mount / when client options change. */
  autoResolve?: boolean;
}

export interface UseDeviceIdentityResult {
  status: DeviceIdentityStatus;
  result: ResolveResponse | null;
  error: unknown;
  deviceId: string | null;
  deviceToken: string | null;
  resolve: (
    options?: Omit<ResolveFlowOptions, keyof DeviceIdentityClientOptions>,
  ) => Promise<ResolveResponse>;
  reverify: (
    options?: Omit<ReverifyFlowOptions, keyof DeviceIdentityClientOptions>,
  ) => Promise<ReverifyResponse>;
  collect: (options?: CollectOptions) => Promise<EvidenceBundle>;
  wipeAnchors: () => Promise<void>;
  wipeLocalState: () => Promise<void>;
}

function clientOptsFrom(
  options: UseDeviceIdentityOptions,
): DeviceIdentityClientOptions {
  const { autoResolve: _auto, ...rest } = options;
  return rest;
}

export function useDeviceIdentity(
  options: UseDeviceIdentityOptions = {},
): UseDeviceIdentityResult {
  const autoResolve = options.autoResolve !== false;
  const clientOpts = clientOptsFrom(options);
  const clientRef = useRef(new DeviceIdentityClient(clientOpts));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep DeviceIdentityClient in sync when transport / profile options change.
  useEffect(() => {
    clientRef.current = new DeviceIdentityClient(clientOpts);
  }, [
    clientOpts.baseUrl,
    clientOpts.profile,
    clientOpts.enrollHardwareAnchor,
    clientOpts.fetch,
  ]);

  const [status, setStatus] = useState<DeviceIdentityStatus>(
    autoResolve ? 'loading' : 'idle',
  );
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  const resolve = useCallback(
    async (
      resolveOptions?: Omit<
        ResolveFlowOptions,
        keyof DeviceIdentityClientOptions
      >,
    ): Promise<ResolveResponse> => {
      if (mountedRef.current) {
        setStatus('loading');
        setError(null);
      }
      try {
        const next = await clientRef.current.resolve(resolveOptions);
        if (mountedRef.current) {
          setResult(next);
          setStatus('ready');
        }
        return next;
      } catch (err) {
        if (mountedRef.current) {
          setError(err);
          setStatus('error');
        }
        throw err;
      }
    },
    [],
  );

  const reverify = useCallback(
    async (
      reverifyOptions?: Omit<
        ReverifyFlowOptions,
        keyof DeviceIdentityClientOptions
      >,
    ): Promise<ReverifyResponse> => {
      if (mountedRef.current) {
        setStatus('loading');
        setError(null);
      }
      try {
        const next = await clientRef.current.reverify(reverifyOptions);
        if (mountedRef.current) {
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  deviceId: next.deviceId,
                  deviceToken: next.deviceToken,
                }
              : null,
          );
          setStatus('ready');
        }
        return next;
      } catch (err) {
        if (mountedRef.current) {
          setError(err);
          setStatus('error');
        }
        throw err;
      }
    },
    [],
  );

  const collect = useCallback(
    (collectOptions?: CollectOptions): Promise<EvidenceBundle> => {
      return clientRef.current.collect(collectOptions);
    },
    [],
  );

  const wipeAnchors = useCallback((): Promise<void> => {
    return clientRef.current.wipeAnchors();
  }, []);

  const wipeLocalState = useCallback((): Promise<void> => {
    return clientRef.current.wipeLocalState();
  }, []);

  useEffect(() => {
    if (!autoResolve) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    void clientRef.current
      .resolve()
      .then((next) => {
        if (cancelled || !mountedRef.current) return;
        setResult(next);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled || !mountedRef.current) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [
    autoResolve,
    clientOpts.baseUrl,
    clientOpts.profile,
    clientOpts.enrollHardwareAnchor,
    clientOpts.fetch,
  ]);

  const deviceId = result?.deviceId ?? null;
  const deviceToken = result?.deviceToken ?? null;

  return useMemo(
    () => ({
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
    }),
    [
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
    ],
  );
}
