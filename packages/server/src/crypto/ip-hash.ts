import { createHmac } from 'node:crypto';

/**
 * HMAC-SHA256 IP hashing with server pepper. Never store raw IPs.
 */

export function hashIp(ip: string, pepper: string): string {
  return createHmac('sha256', pepper).update(ip, 'utf8').digest('hex');
}

/** /24 for IPv4; /48 for IPv6 (first 6 hextets). */
export function ipNetworkKey(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    // Expand poorly — for hashing we take first 3 non-empty segments + pad.
    const hextets: string[] = [];
    for (const p of parts) {
      if (p === '' && hextets.length === 0) {
        // leading ::
        continue;
      }
      if (p === '') break;
      hextets.push(p);
      if (hextets.length >= 3) break;
    }
    while (hextets.length < 3) hextets.push('0');
    return `${hextets.slice(0, 3).join(':')}::/48`;
  }

  const octets = trimmed.split('.');
  if (octets.length !== 4) return trimmed;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

export function hashIp24(ip: string, pepper: string): string {
  return hashIp(ipNetworkKey(ip), pepper);
}
