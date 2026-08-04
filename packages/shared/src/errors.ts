/**
 * Wire error codes for ErrorResponse.
 */

export const ERROR_CODES = [
  'NONCE_INVALID',
  'NONCE_EXPIRED',
  'NONCE_REPLAY',
  'ORIGIN_MISMATCH',
  'SIGNATURE_INVALID',
  'RATE_LIMITED',
  'PAYLOAD_INVALID',
  'UNAUTHORIZED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
