import { describe, expect, it } from 'vitest';
import { settleFileOperations } from './batchOperations';

describe('settleFileOperations', () => {
  it('limits concurrent requests and preserves result order when some fail', async () => {
    let active = 0;
    let maximum = 0;
    const results = await settleFileOperations([0, 1, 2, 3, 4, 5, 6, 7, 8], async (item) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      if (item === 3) throw new Error('conflict');
      return item;
    });

    expect(maximum).toBeLessThanOrEqual(4);
    expect(results.map((result) => result.status)).toEqual([
      'fulfilled', 'fulfilled', 'fulfilled', 'rejected', 'fulfilled',
      'fulfilled', 'fulfilled', 'fulfilled', 'fulfilled',
    ]);
    expect(results[8].value).toBe(8);
  });
});
