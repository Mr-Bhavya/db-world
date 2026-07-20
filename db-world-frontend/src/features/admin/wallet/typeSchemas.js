import { z } from 'zod';

export const typeSchema = z.object({
  code: z.string().min(2, 'Min 2 chars').max(40).regex(/^[A-Z0-9_]+$/i, 'Letters, digits, underscore only'),
  displayName: z.string().min(2, 'Min 2 chars').max(100),
  description: z.string().max(300).optional().or(z.literal('')),
  numberLabel: z.string().max(60).optional().or(z.literal('')),
  requiresNumber: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
