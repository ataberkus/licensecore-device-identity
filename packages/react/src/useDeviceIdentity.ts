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
  /** When true (default), call resolve() once on mount. */
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
  const clientRef = useRef<DeviceIdentityClient | null>(null);

  if (clientRef.current === null) {
    clientRef.current = new DeviceIdentityClient(clientOpts);
  }

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
      setStatus('loading');
      setError(null);
      try {
        const next = await clientRef.current!.resolve(resolveOptions);
        setResult(next);
        setStatus('ready');
        return next;
      } catch (err) {
        setError(err);
        setStatus('error');
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
      setStatus('loading');
      setError(null);
      try {
        const next = await clientRef.current!.reverify(reverifyOptions);
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
        return next;
      } catch (err) {
        setError(err);
        setStatus('error');
        throw err;
      }
    },
    [],
  );

  const collect = useCallback(
    (collectOptions?: CollectOptions): Promise<EvidenceBundle> => {
      return clientRef.current!.collect(collectOptions);
    },
    [],
  );

  const wipeAnchors = useCallback((): Promise<void> => {
    return clientRef.current!.wipeAnchors();
  }, []);

  const wipeLocalState = useCallback((): Promise<void> => {
    return clientRef.current!.wipeLocalState();
  }, []);

  useEffect(() => {
    if (!autoResolve) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    void clientRef
      .current!.resolve()
      .then((next) => {
        if (cancelled) return;
        setResult(next);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // Intentionally once on mount for default autoResolve; options.baseUrl etc.
    // are captured into the client constructed on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResolve]);

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
