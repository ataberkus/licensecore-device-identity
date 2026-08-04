import { z } from 'zod';

export const DeviceEventTypeSchema = z.enum([
  'enroll',
  'recognize',
  'rebind',
  'drift',
  'ambiguous',
  'spoof_flag',
  'anchor_revoked',
]);
export type DeviceEventType = z.infer<typeof DeviceEventTypeSchema>;

export const DeviceEventSchema = z.object({
  type: DeviceEventTypeSchema,
  deviceId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
});
export type DeviceEvent = z.infer<typeof DeviceEventSchema>;
