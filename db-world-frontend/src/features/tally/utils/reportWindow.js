import { todayIso } from './chartSeries';

/**
 * The stretch of time a report is showing, and how you move it.
 *
 * <h2>Two ways of asking, one shape</h2>
 * A window is either a named calendar period — a week, a month, a year, plus an optional anchor
 * naming which one — or an explicit pair of dates. The server resolves both and the difference
 * barely surfaces in the UI, but it matters here for one reason: <b>stepping</b>. Stepping a
 * calendar period means handing back an anchor the server worked out, because only the server
 * should decide that the month before 31 March is February rather than "thirty days earlier".
 * Stepping an explicit range means sliding both ends by its own length, which needs no server at
 * all — there is no calendar question to get wrong.
 *
 * <p>Dates are ISO {@code YYYY-MM-DD} strings, the same form the server reads and writes, so
 * nothing here ever builds a Date only to format it back again — which is where time zones get
 * in and quietly move an evening into the previous day.
 */

/** What a report opens on. */
export const DEFAULT_WINDOW = { period: 'MONTH', anchor: null, from: null, to: null };

/** Explicit dates, rather than a named calendar period. */
export const isCustom = (window) => Boolean(window?.from && window?.to);

const MS_DAY = 86400000;

/** Parsed as local midnight — `new Date('2026-09-15')` is parsed as UTC and can be a day out. */
function parse(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso, days) {
  const date = parse(iso);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}

/** How many days a range covers, both ends included. */
export function spanDays(from, to) {
  if (!from || !to) return 0;
  return Math.round((parse(to) - parse(from)) / MS_DAY) + 1;
}

/**
 * Slide an explicit range one whole length backwards or forwards.
 *
 * <p>By its own span, not by a month: a 47-day window stepped back is the 47 days before it, and
 * the two together tile the calendar with no gap and no overlap. That is the same relationship
 * the report's own "versus last period" comparison uses, so stepping back once lands you exactly
 * on the window you were just being compared against.
 */
export function shiftWindow(window, direction) {
  const span = spanDays(window.from, window.to);
  const move = direction * span;
  return { ...window, from: addDays(window.from, move), to: addDays(window.to, move) };
}

/**
 * Whether there is anywhere to step.
 *
 * <p>Forward is refused once the window already reaches today, for the same reason the server
 * refuses a calendar step into a month that has not begun: a button that is always enabled and
 * always lands on an empty chart reads as a broken screen rather than as the end of the data.
 */
export function canStep(window, report, direction, today = todayIso()) {
  if (isCustom(window)) {
    return direction < 0 ? Boolean(window.from) : window.to < today;
  }
  return Boolean(direction < 0 ? report?.previousAnchor : report?.nextAnchor);
}

/** The window one step away, whichever kind it is. */
export function steppedWindow(window, report, direction) {
  if (isCustom(window)) return shiftWindow(window, direction);
  const anchor = direction < 0 ? report?.previousAnchor : report?.nextAnchor;
  return anchor ? { ...window, anchor } : window;
}

/**
 * Switch to a named period.
 *
 * <p>The anchor and the explicit dates are both dropped. An anchor is a date inside a period of
 * the old size, and carrying it over lands you on a window you did not ask for — pick "week"
 * while looking at March and you get the week around the 1st rather than the week you meant.
 * Going back to the current period is the only unsurprising answer.
 */
export function periodWindow(period) {
  return { period, anchor: null, from: null, to: null };
}

/** Switch to explicit dates, keeping the period only as what to fall back to. */
export function customWindow(from, to) {
  return { period: 'CUSTOM', anchor: null, from, to };
}

/**
 * What goes on the wire.
 *
 * <p>`CUSTOM` is this client's word for "the dates below are the question" and means nothing to
 * the server, which would reject it as an unknown period — so a custom window sends the period
 * it is not using rather than the one it is.
 */
export function windowParams(window) {
  if (isCustom(window)) return { period: 'MONTH', from: window.from, to: window.to };
  return { period: window.period, anchor: window.anchor ?? undefined };
}
