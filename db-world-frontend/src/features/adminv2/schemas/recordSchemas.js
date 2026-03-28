import { z } from 'zod';

export const createRecordSchema = z.object({
  type:   z.enum(['MOVIE', 'SERIES'], { required_error: 'Type is required' }),
  tmdbId: z.coerce.number().int().positive('Must be a positive integer'),
});

export const updateRecordSchema = createRecordSchema;

export const addTagSchema = z.object({
  tagType:  z.enum(['FEATURED','NEW_RELEASE','TRENDING','EDITOR_PICK','SHOW_ON_TOP','RECENTLY_ADDED','TOP_10']),
  priority: z.coerce.number().int().min(0).max(999).optional(),
});
