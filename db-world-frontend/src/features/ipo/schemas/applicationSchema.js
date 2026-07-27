import { z } from 'zod';

/** Indian PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F). The field is uppercased as the
 * user types (see AllotmentTab's Controller), so this only ever validates against upper-case. */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Matches `IpoUserApplicationEntity.allotmentResult` — the applicant's own self-recorded
 * result, distinct from the IPO's registrar-reported `allotmentStatus`. */
export const ALLOTMENT_RESULT_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'allotted', label: 'Allotted' },
  { value: 'not_allotted', label: 'Not allotted' },
];

// Column lengths mirror IpoUserApplicationEntity so a save can never 500 on a truncation error.
export const applicationSchema = z.object({
  applicantName: z.string().max(150, 'Max 150 chars').optional().or(z.literal('')),
  applicationNo: z.string().max(100, 'Max 100 chars').optional().or(z.literal('')),
  dpClientId: z.string().max(100, 'Max 100 chars').optional().or(z.literal('')),
  // Optional — a blank PAN means "leave whatever's already saved untouched" (the server only
  // ever persists the last 4 characters anyway, so re-typing it every save isn't required).
  pan: z.string().optional().or(z.literal(''))
    .refine((v) => !v || PAN_REGEX.test(v), { message: 'Enter a valid PAN (e.g. ABCDE1234F)' }),
  allotmentResult: z.string().optional().or(z.literal('unknown')),
});

export const APPLICATION_DEFAULT_VALUES = {
  applicantName: '', applicationNo: '', dpClientId: '', pan: '', allotmentResult: 'unknown',
};
