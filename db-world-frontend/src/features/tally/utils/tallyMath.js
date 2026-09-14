/**
 * The split arithmetic, mirroring the server's `TallyAllocator` exactly.
 *
 * This exists so the Add-expense dialog can show what everyone will owe *before* saving. That
 * makes it a second implementation of the same rules, which is normally a smell — here it is
 * the point, and the risk it carries is specific: if the preview and the server ever disagree,
 * the user is shown one number and charged another. The two test suites therefore share the
 * same fixtures, and this file must not be "improved" independently of the Java one.
 *
 * Same method: largest remainder in integer paise. Floor everyone's exact entitlement, then hand
 * the leftover paise one each to whoever was rounded down hardest, breaking ties on member id.
 * The naive `total / n` rounded per share is wrong in both directions — ₹100 across 3 loses a
 * paisa, across 6 it invents two — and in a ledger that has to close to zero, either is fatal.
 *
 * Arithmetic runs in BigInt rather than floats. `0.1 + 0.2 !== 0.3` is the whole reason: money
 * that cannot be represented cannot be reconciled, and `total * weight` overflows the exact
 * integer range of a double long before BigInt breaks a sweat.
 */

/** Rupees (string or number) to a whole number of paise. Throws on sub-paisa precision. */
export function toPaise(value) {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new Error(`Not an amount: ${value}`);
  }
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > 2) {
    throw new Error(`Amount must be a whole number of paise, got: ${value}`);
  }
  const sign = whole.startsWith('-') ? -1n : 1n;
  const digits = BigInt(whole.replace('-', '')) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  return sign * digits;
}

/** Paise back to a display string that always carries both decimals. */
export function fromPaise(paise) {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const rupees = abs / 100n;
  const remainder = abs % 100n;
  return `${negative ? '-' : ''}${rupees}.${String(remainder).padStart(2, '0')}`;
}

/** Scales a decimal weight to an integer at the given number of decimal places. */
function scaleWeight(weight, decimals) {
  const text = typeof weight === 'string' ? weight.trim() : String(weight ?? '0');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole || '0') * 10n ** BigInt(decimals)
       + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
}

const decimalsIn = (weight) => String(weight ?? '').split('.')[1]?.length ?? 0;

/**
 * Splits `total` across weighted participants so the parts sum to the whole, exactly.
 *
 * @param {string|number} total   the amount to divide
 * @param {Array<{memberId: string, weight: string|number}>} weights
 * @returns {Array<{memberId: string, paise: bigint, amount: string}>} in the caller's order
 */
export function allocate(total, weights) {
  if (!weights?.length) return [];

  const totalPaise = toPaise(total);
  if (totalPaise < 0n) throw new Error(`Cannot split a negative amount: ${total}`);

  const decimals = Math.max(0, ...weights.map((w) => decimalsIn(w.weight)));
  const scaled = weights.map((w) => ({ memberId: w.memberId, weight: scaleWeight(w.weight, decimals) }));
  const weightSum = scaled.reduce((sum, w) => sum + w.weight, 0n);
  if (weightSum <= 0n) throw new Error('Split weights must add up to more than zero');

  let allocated = 0n;
  const drafts = scaled.map(({ memberId, weight }) => {
    const exact = totalPaise * weight;
    const base = exact / weightSum;          // BigInt division truncates, which is floor here
    allocated += base;
    return { memberId, base, remainder: exact % weightSum };
  });

  // Strictly fewer left over than there are participants, because each was short by under a paisa.
  const shortfall = Number(totalPaise - allocated);

  // Ties break on member id, never on position. Voiding an expense re-runs this to write the
  // reversal, and a run that disagreed with the first by a paisa would be baked into the ledger.
  const getsExtra = new Set(
    [...drafts]
      .sort((a, b) => {
        if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
        return a.memberId < b.memberId ? -1 : 1;
      })
      .slice(0, shortfall)
      .map((d) => d.memberId),
  );

  // Rebuilt in the caller's order: that is the order the dialog renders, and reordering here
  // would make the preview's rows jump around as weights are typed.
  return drafts.map((d) => {
    const paise = d.base + (getsExtra.has(d.memberId) ? 1n : 0n);
    return { memberId: d.memberId, paise, amount: fromPaise(paise) };
  });
}

/** Equal split — the common case, and the one where the remainder bites hardest. */
export const allocateEqually = (total, memberIds) =>
  allocate(total, memberIds.map((memberId) => ({ memberId, weight: 1 })));

/** Percentages as weights, so the parts still sum exactly even when they cannot divide cleanly. */
export const allocateByPercent = (total, entries) =>
  allocate(total, entries.map((e) => ({ memberId: e.memberId, weight: e.percent ?? 0 })));

/** Relative shares — "two for the couple, one each for the rest". */
export const allocateByShares = (total, entries) =>
  allocate(total, entries.map((e) => ({ memberId: e.memberId, weight: e.shareWeight ?? 0 })));

/** Sums decimal amounts without ever touching a float. Returns a display string. */
export function sumAmounts(amounts) {
  const total = amounts.reduce((sum, a) => {
    try {
      return sum + toPaise(a);
    } catch {
      return sum;   // a half-typed field is not an error yet, it is just not a number
    }
  }, 0n);
  return fromPaise(total);
}

/** True when `parts` add up to `total` to the paisa. Used to gate the dialog's save button. */
export function addsUp(total, parts) {
  try {
    return toPaise(sumAmounts(parts)) === toPaise(total);
  } catch {
    return false;
  }
}

/**
 * Previews an expense the way the server will record it.
 *
 * Returns one row per participant with the amount they consume, plus who actually settles it
 * once the group's standing delegations are applied — the distinction the whole app is built on.
 */
export function previewShares({ total, method, participants, delegationOf }) {
  const rows = (() => {
    switch (method) {
      case 'EXACT':
        return participants.map((p) => {
          const paise = (() => { try { return toPaise(p.exactAmount ?? 0); } catch { return 0n; } })();
          return { memberId: p.memberId, paise, amount: fromPaise(paise) };
        });
      case 'PERCENT': return allocateByPercent(total, participants);
      case 'SHARES':  return allocateByShares(total, participants);
      default:        return allocateEqually(total, participants.map((p) => p.memberId));
    }
  })();

  return rows.map((row) => ({
    ...row,
    owedByMemberId: participants.find((p) => p.memberId === row.memberId)?.owedByMemberId
      ?? delegationOf?.(row.memberId)
      ?? row.memberId,
  }));
}
