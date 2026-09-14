import { z } from 'zod';

/**
 * Client-side validation, mirroring the backend's column lengths and constraints.
 *
 * Mirrored, not guessed: every `max` here is the `@Size` on the matching Java field. When the
 * two drift the server wins and the user gets a 400 with a message about a column, which is the
 * one error this app should never produce — everything else it refuses, it refuses in words.
 */

/** Two decimals, always. MySQL in strict mode errors on a third where H2 would round it. */
const money = (label = 'Amount') => z
  .string()
  .trim()
  .min(1, `${label} is required`)
  .regex(/^\d+(\.\d{1,2})?$/, 'Use rupees and paise, like 249.50')
  .refine((v) => Number(v) > 0, `${label} must be more than zero`)
  .refine((v) => Number(v) <= 9_999_999_999, 'That is more than this app can hold');

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(120, 'That name is too long'),
  category: z.string().trim().max(60).optional().or(z.literal('')),
});

export const addMemberSchema = z.object({
  // A ghost needs a name; a real account can borrow theirs. The either/or is checked below
  // rather than in the field, because neither field is wrong on its own.
  userId: z.number().int().positive().nullable().optional(),
  displayName: z.string().trim().max(120, 'That name is too long').optional().or(z.literal('')),
  email: z.string().trim().email('That does not look like an email').max(190).optional().or(z.literal('')),
}).refine(
  (v) => Boolean(v.userId) || Boolean(v.displayName?.trim()),
  { path: ['displayName'], message: 'Pick somebody, or type a name for them' },
);

export const expenseSchema = z.object({
  description: z.string().trim().min(1, 'What was it for?').max(200, 'That is a bit long for a title'),
  totalAmount: money('Amount'),
  divisionMethod: z.enum(['EQUAL', 'EXACT', 'PERCENT', 'SHARES']),
  category: z.string().trim().max(60).optional().or(z.literal('')),
  expenseDate: z.string().min(1, 'Pick a date'),
  notes: z.string().trim().max(1000, 'That note is too long').optional().or(z.literal('')),

  // Who paid. Kept as a list from the start rather than a single id: two people splitting the
  // bill at the till is ordinary, and retrofitting it later would change every row's shape.
  payers: z.array(z.object({
    memberId: z.string().min(1),
    amount: money('Paid'),
  })).min(1, 'Somebody has to have paid'),

  participants: z.array(z.object({
    memberId: z.string().min(1),
    exactAmount: z.string().optional(),
    percent: z.string().optional(),
    shareWeight: z.string().optional(),
    owedByMemberId: z.string().optional().nullable(),
  })).min(1, 'Pick at least one person to split this with'),
});

export const settlementSchema = z.object({
  fromMemberId: z.string().min(1, 'Who paid?'),
  toMemberId: z.string().min(1, 'Who did they pay?'),
  amount: money('Amount'),
  method: z.string().trim().max(40).optional().or(z.literal('')),
  settledAt: z.string().optional(),
}).refine((v) => v.fromMemberId !== v.toMemberId, {
  path: ['toMemberId'],
  message: 'Pick two different people',
});

/** Payment methods offered in the dialog. Free text on the server; a menu is faster to use. */
export const SETTLEMENT_METHODS = ['UPI', 'Cash', 'Bank transfer', 'Card', 'Other'];
