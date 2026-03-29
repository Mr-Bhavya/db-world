import { z } from 'zod';

// Create modal: tmdbId is set from TMDB search selection, not a form field
export const createRecordSchema = z.object({
  type: z.enum(['MOVIE', 'TV_SERIES'], { required_error: 'Type is required' }),
});

// Edit modal: tmdbId IS a form field the user fills in
export const updateRecordSchema = z.object({
  type:   z.enum(['MOVIE', 'TV_SERIES'], { required_error: 'Type is required' }),
  tmdbId: z.coerce.number().int().positive('Must be a positive integer'),
});

export const addTagSchema = z.object({
  tagType:  z.enum(['FEATURED','NEW_RELEASE','TRENDING','EDITOR_PICK','SHOW_ON_TOP','RECENTLY_ADDED','TOP_10']),
  priority: z.coerce.number().int().min(0).max(999).optional(),
});
