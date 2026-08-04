import { z } from 'zod';

export const AnchorTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type AnchorTier = z.infer<typeof AnchorTierSchema>;

/**
 * Anchor proof (client → server).
 * Signature is b64url over SHA-256(nonce||origin||stableHash||keyId)
 * as ECDSA-P256 IEEE P1363 raw 64-byte (r||s).
 */
export const AnchorProofSchema = z.object({
  tier: AnchorTierSchema,
  /** public key thumbprint (hex) or credentialId (b64url) */
  keyId: z.string().min(1),
  /** b64url signature */
  signature: z.string().min(1),
  /** b64url; required on first enroll of Tier 2 */
  publicKeySpki: z.string().min(1).optional(),
  /** b64url; Tier 1 create */
  attestationObject: z.string().min(1).optional(),
  /** b64url; Tier 1 */
  clientDataJSON: z.string().min(1).optional(),
  /** b64url; Tier 1 get */
  authenticatorData: z.string().min(1).optional(),
  signCount: z.number().int().nonnegative().optional(),
});
export type AnchorProof = z.infer<typeof AnchorProofSchema>;
