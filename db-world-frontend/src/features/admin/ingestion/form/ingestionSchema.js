import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

// Season 0 is TMDB's Specials season — bonus episodes, behind-the-scenes,
// recaps. Rejecting it here made specials unlinkable from the ingestion form
// even though the backend, the TMDB sync and the viewer all handle season 0
// perfectly well. Episode numbers still start at 1 within that season.
const nonNegativeOptionalInt = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  })
  .refine((value) => value === null || (Number.isInteger(value) && value >= 0), {
    message: 'Must be 0 or a positive integer',
  });

const urlSchema = z.object({
  url: z.string().trim().optional().default(''),
  customName: z.string().optional().default(''),
  rename: z.boolean().default(false),
  episode: nonNegativeOptionalInt.optional().nullable(),
});

export const schema = z.object({
  urls: z.array(urlSchema).default([
    { url: '', customName: '', rename: false, episode: null },
  ]),
  record: z.any().optional().nullable(),
  season: nonNegativeOptionalInt.optional().nullable(),
  episode: nonNegativeOptionalInt.optional().nullable(),

  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  useAuth: z.boolean().default(false),

  extract: z.boolean().default(false),
  zipPwd: z.string().optional().default(''),

  audioOnly: z.boolean().default(false),

  reviewTracks: z.boolean().default(false),

  videoITag: z.string().optional().nullable(),
  audioITag: z.string().optional().nullable(),
  videoQuality: z.string().optional().default('best'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Default form values
// ─────────────────────────────────────────────────────────────────────────────

export const EMPTY_DEFAULTS = {
  urls: [{ url: '', customName: '', rename: false, episode: null }],
  record: null,
  season: null,
  episode: null,
  username: '',
  password: '',
  useAuth: false,
  extract: false,
  zipPwd: '',
  audioOnly: false,
  reviewTracks: false,
  videoITag: null,
  audioITag: null,
  videoQuality: 'best',
};
