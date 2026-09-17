/**
 * The arithmetic behind the report's charts, kept out of the components that draw them.
 *
 * <p>Here rather than inside the chart because it is the part that can be wrong without looking
 * wrong. A running total that quietly keeps climbing across days that have not happened, or a
 * comparison line one day out of step, draws a perfectly tidy chart that says something untrue —
 * and there is no rendering test in this project that would catch it. Pure functions can be
 * checked; a chart on a screen can only be looked at.
 */

/** Today as the server writes dates, so the two can be compared as plain strings. */
export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * A running total over `buckets`, stopping after index `upTo`.
 *
 * <p>Points past the stop are null rather than repeats of the last value: a line charting series
 * treats null as "no point here" and simply ends, where a repeated value would draw a flat tail.
 */
function runningTotal(buckets, upTo = buckets.length) {
  let total = 0;
  return buckets.map((bucket, i) => {
    if (i >= upTo) return null;
    total += Number(bucket?.amount ?? 0);
    return total;
  });
}

/**
 * This period's spending as a climbing total, with the period before it alongside.
 *
 * <h2>The two things this gets right</h2>
 * <b>It stops at today.</b> The server sends every bucket in the period including the ones still
 * to come, because the bar chart needs the empty days to show the gaps between spends. A running
 * total drawn over those same buckets runs flat to the end of the month, which reads as "we
 * stopped spending on the 16th" rather than "the 16th is today".
 *
 * <p><b>It aligns the two periods by index, not by date.</b> Day 1 against day 1, because the
 * question is "where had last month got to by this point", and the periods are not the same
 * length. February against January leaves three of January's days with nothing to sit beside;
 * they are dropped rather than piled onto the 28th. The other way round, February against March,
 * leaves the comparison short, and the tail is null so the grey line simply ends early instead
 * of dropping to zero — which would read as a month that stopped spending.
 *
 * @param today ISO {@code YYYY-MM-DD}. Injectable so the truncation can be tested without
 *              waiting for a particular day of the month to come round.
 * @returns current and previous arrays, both exactly as long as {@code buckets}, plus whether
 *          the previous period has anything in it worth drawing.
 */
export function cumulativeSeries(buckets = [], previousBuckets = [], today = todayIso()) {
  // The first bucket that has not started yet. A period entirely in the past has none, and runs
  // to its end; the current one stops where the calendar does.
  let openAt = buckets.length;
  for (let i = 0; i < buckets.length; i += 1) {
    if (String(buckets[i]?.start ?? '') > today) { openAt = i; break; }
  }

  const previous = runningTotal(previousBuckets)
    .slice(0, buckets.length)
    .concat(Array(Math.max(0, buckets.length - previousBuckets.length)).fill(null));

  return {
    current: runningTotal(buckets, openAt),
    previous,
    // A flat zero line labelled "last month" says the group did not exist yet, which is not what
    // it means. With nothing to compare against this is simply a running total.
    hasPrevious: previous.some((value) => Number(value) > 0),
  };
}
