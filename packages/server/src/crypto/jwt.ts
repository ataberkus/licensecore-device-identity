import { SignJWT, jwtVerify } from 'jose';
import { DEVICE_TOKEN_TTL_MS } from '@licensecore/shared';

export type DeviceTokenClaims = {
  sub: string; // deviceId
  cnf: { jkt: string };
};

/**
 * Mint a 10-minute deviceToken JWT with cnf.jkt (empty string for Tier 3).
 */
export async function mintDeviceToken(opts: {
  deviceId: string;
  jkt: string;
  secret: string;
  nowMs?: number;
}): Promise<{ token: string; expiresAt: number }> {
  const nowMs = opts.nowMs ?? Date.now();
  const expiresAt = nowMs + DEVICE_TOKEN_TTL_MS;
  const secret = new TextEncoder().encode(opts.secret);
  const token = await new SignJWT({
    cnf: { jkt: opts.jkt },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(opts.deviceId)
    .setIssuedAt(Math.floor(nowMs / 1000))
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(secret);
  return { token, expiresAt };
}

export async function verifyDeviceToken(
  token: string,
  secret: string,
): Promise<DeviceTokenClaims> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
  const sub = payload.sub;
  if (!sub) throw new Error('missing sub');
  const cnf = payload['cnf'] as { jkt?: string } | undefined;
  return { sub, cnf: { jkt: cnf?.jkt ?? '' } };
}
