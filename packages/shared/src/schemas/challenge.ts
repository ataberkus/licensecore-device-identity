import { z } from 'zod';

export const ChallengeRequestSchema = z.object({
  /** also bound from Origin header */
  origin: z.string().min(1),
});
export type ChallengeRequest = z.infer<typeof ChallengeRequestSchema>;

export const ChallengeResponseSchema = z.object({
  /** 32 bytes → 64 hex */
  nonce: z.string().length(64).regex(/^[0-9a-f]+$/i),
  /** epoch ms, now+60s */
  expiresAt: z.number().int().positive(),
  serverTimeMs: z.number().int().positive(),
});
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;
