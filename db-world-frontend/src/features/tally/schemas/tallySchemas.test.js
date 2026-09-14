import { describe, it, expect } from 'vitest';
import { expenseSchema, settlementSchema, addMemberSchema } from './tallySchemas';

/**
 * These schemas gate the submit handlers, so a payload they reject is a button that does
 * nothing. That is not hypothetical — it shipped once.
 *
 * `exactAmount` and friends were declared `z.string().optional()`, which in zod v4 means
 * `string | undefined` and rejects null. JSON has no undefined, so the dialog naturally sent
 * null for every field the chosen split method did not use, the whole payload was refused, and
 * the handler returned without a word. Every expense, every time.
 *
 * So the important test here is not "does the schema validate bad input" — it is "does it
 * accept the exact shape the dialog actually builds". Those are different questions, and only
 * the second one was wrong.
 */

/** Mirrors AddExpenseDialog's payload construction, nulls and all. */
const dialogPayload = (over = {}) => ({
  description: 'Groceries',
  totalAmount: '100.00',
  divisionMethod: 'EQUAL',
  category: null,
  expenseDate: '2026-09-14',
  notes: null,
  idempotencyKey: 'k-abc',
  payers: [{ memberId: 'm1', amount: '100.00' }],
  participants: [
    { memberId: 'm1', exactAmount: null, percent: null, shareWeight: null, owedByMemberId: 'm1' },
    { memberId: 'm2', exactAmount: null, percent: null, shareWeight: null, owedByMemberId: 'm2' },
  ],
  ...over,
});

const why = (result) => (result.success ? [] : result.error.issues.map(
  (i) => `${i.path.join('.')}: ${i.message}`,
));

describe('expenseSchema accepts what the dialog sends', () => {
  it('takes the plain one-payer equal split', () => {
    const result = expenseSchema.safeParse(dialogPayload());
    expect(why(result)).toEqual([]);
  });

  it('takes an EXACT split, where percent and shareWeight are null', () => {
    const result = expenseSchema.safeParse(dialogPayload({
      divisionMethod: 'EXACT',
      participants: [
        { memberId: 'm1', exactAmount: '60.00', percent: null, shareWeight: null, owedByMemberId: 'm1' },
        { memberId: 'm2', exactAmount: '40.00', percent: null, shareWeight: null, owedByMemberId: 'm2' },
      ],
    }));
    expect(why(result)).toEqual([]);
  });

  it('takes a PERCENT split', () => {
    const result = expenseSchema.safeParse(dialogPayload({
      divisionMethod: 'PERCENT',
      participants: [
        { memberId: 'm1', exactAmount: null, percent: '50', shareWeight: null, owedByMemberId: 'm1' },
        { memberId: 'm2', exactAmount: null, percent: '50', shareWeight: null, owedByMemberId: 'm2' },
      ],
    }));
    expect(why(result)).toEqual([]);
  });

  it('takes a SHARES split', () => {
    const result = expenseSchema.safeParse(dialogPayload({
      divisionMethod: 'SHARES',
      participants: [
        { memberId: 'm1', exactAmount: null, percent: null, shareWeight: '2', owedByMemberId: 'm1' },
        { memberId: 'm2', exactAmount: null, percent: null, shareWeight: '1', owedByMemberId: 'm2' },
      ],
    }));
    expect(why(result)).toEqual([]);
  });

  it('takes several payers', () => {
    const result = expenseSchema.safeParse(dialogPayload({
      payers: [
        { memberId: 'm1', amount: '60.00' },
        { memberId: 'm2', amount: '40.00' },
      ],
    }));
    expect(why(result)).toEqual([]);
  });

  it('takes a split with exactly one participant', () => {
    // Splitting with one other person is an ordinary case, not an edge one.
    const result = expenseSchema.safeParse(dialogPayload({
      participants: [
        { memberId: 'm2', exactAmount: null, percent: null, shareWeight: null, owedByMemberId: 'm2' },
      ],
    }));
    expect(why(result)).toEqual([]);
  });

  it('takes a category and a note when they are filled in', () => {
    const result = expenseSchema.safeParse(dialogPayload({ category: 'Food', notes: 'Split at the till' }));
    expect(why(result)).toEqual([]);
  });
});

describe('expenseSchema still refuses what it should', () => {
  it('rejects sub-paisa amounts', () => {
    // MySQL strict mode errors where H2 rounds; it has to die at the edge.
    expect(expenseSchema.safeParse(dialogPayload({ totalAmount: '10.001' })).success).toBe(false);
  });

  it('rejects zero and negative totals', () => {
    expect(expenseSchema.safeParse(dialogPayload({ totalAmount: '0' })).success).toBe(false);
    expect(expenseSchema.safeParse(dialogPayload({ totalAmount: '-5.00' })).success).toBe(false);
  });

  it('rejects an empty description', () => {
    expect(expenseSchema.safeParse(dialogPayload({ description: '   ' })).success).toBe(false);
  });

  it('rejects an expense with nobody paying or nobody splitting', () => {
    expect(expenseSchema.safeParse(dialogPayload({ payers: [] })).success).toBe(false);
    expect(expenseSchema.safeParse(dialogPayload({ participants: [] })).success).toBe(false);
  });
});

describe('settlementSchema', () => {
  const payment = (over = {}) => ({
    fromMemberId: 'm1', toMemberId: 'm2', amount: '50.00', method: '', settledAt: undefined, ...over,
  });

  it('takes what RecordPaymentDialog sends', () => {
    expect(why(settlementSchema.safeParse(payment()))).toEqual([]);
    expect(why(settlementSchema.safeParse(payment({ method: 'UPI' })))).toEqual([]);
  });

  it('refuses a payment to yourself', () => {
    const result = settlementSchema.safeParse(payment({ toMemberId: 'm1' }));
    expect(result.success).toBe(false);
  });
});

describe('addMemberSchema', () => {
  it('takes a real account, or a ghost with just a name', () => {
    expect(why(addMemberSchema.safeParse({ userId: 7, displayName: '', email: '' }))).toEqual([]);
    expect(why(addMemberSchema.safeParse({ displayName: 'Amma' }))).toEqual([]);
  });

  it('refuses somebody with neither an account nor a name', () => {
    expect(addMemberSchema.safeParse({ displayName: '   ' }).success).toBe(false);
  });
});
