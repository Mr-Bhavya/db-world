import { z } from 'zod';

export const addDocumentSchema = z.object({
  typeId: z.string().min(1, 'Select a document type'),
  label:  z.string().max(150, 'Max 150 chars').optional().or(z.literal('')),
  number: z.string().max(100).optional().or(z.literal('')),
  issueDate:  z.string().optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  notes:  z.string().max(2000).optional().or(z.literal('')),
});

export const editDocumentSchema = z.object({
  label:  z.string().min(1, 'Required').max(150),
  number: z.string().max(100).optional().or(z.literal('')),
  issueDate:  z.string().optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  notes:  z.string().max(2000).optional().or(z.literal('')),
});

export const ACCEPTED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];
