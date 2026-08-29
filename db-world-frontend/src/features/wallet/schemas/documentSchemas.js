import { z } from 'zod';

/** `<input type="date">` yields "yyyy-MM-dd" or "" — exactly the shape `LocalDate` binds to on the
 * server, so the value passes straight through. Empty means "not recorded", not invalid. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date').optional().or(z.literal(''));

export const addDocumentSchema = z.object({
  typeId: z.string().min(1, 'Select a document type'),
  label:  z.string().max(150, 'Max 150 chars').optional().or(z.literal('')),
  number: z.string().max(100).optional().or(z.literal('')),
  notes:  z.string().max(2000).optional().or(z.literal('')),
  holderName: z.string().max(120, 'Max 120 chars').optional().or(z.literal('')),
  issueDate: isoDate,
  expiryDate: isoDate,
});

export const editDocumentSchema = z.object({
  label:  z.string().min(1, 'Required').max(150),
  number: z.string().max(100).optional().or(z.literal('')),
  notes:  z.string().max(2000).optional().or(z.literal('')),
  holderName: z.string().max(120, 'Max 120 chars').optional().or(z.literal('')),
  issueDate: isoDate,
  expiryDate: isoDate,
});

export const ACCEPTED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];
