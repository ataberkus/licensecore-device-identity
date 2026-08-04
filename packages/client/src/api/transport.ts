import type {
  ChallengeRequest,
  ChallengeResponse,
  ErrorResponse,
  ReverifyRequest,
  ReverifyResponse,
  ResolveRequest,
  ResolveResponse,
} from '@licensecore/shared';

export class DeviceIdentityTransportError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'DeviceIdentityTransportError';
    this.status = status;
    this.body = body;
  }
}

export interface TransportOptions {
  /** API base, e.g. `https://api.example.com` or `` for same-origin. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/+$/u, '')}${path}`;
}

async function postJson<T>(
  opts: TransportOptions,
  path: string,
  body: unknown,
): Promise<T> {
  const fetchFn = opts.fetch ?? fetch;
  const res = await fetchFn(joinUrl(opts.baseUrl ?? '', path), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const errBody = parsed as ErrorResponse | null;
    const code =
      errBody &&
      typeof errBody === 'object' &&
      errBody !== null &&
      'error' in errBody &&
      errBody.error &&
      typeof errBody.error === 'object' &&
      'code' in errBody.error
        ? String((errBody.error as { code: string }).code)
        : `HTTP_${res.status}`;
    throw new DeviceIdentityTransportError(code, res.status, parsed);
  }
  return parsed as T;
}

export async function fetchChallenge(
  origin: string,
  opts: TransportOptions = {},
): Promise<ChallengeResponse> {
  const body: ChallengeRequest = { origin };
  return postJson<ChallengeResponse>(opts, '/v1/device/challenge', body);
}

export async function postResolve(
  request: ResolveRequest,
  opts: TransportOptions = {},
): Promise<ResolveResponse> {
  return postJson<ResolveResponse>(opts, '/v1/device/resolve', request);
}

export async function postReverify(
  request: ReverifyRequest,
  opts: TransportOptions = {},
): Promise<ReverifyResponse> {
  return postJson<ReverifyResponse>(opts, '/v1/device/reverify', request);
}
