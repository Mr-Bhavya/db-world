/**
 * Turning tally's numbers and enums into the words and colours the screen uses.
 *
 * Wording is the load-bearing part here, not the arithmetic. "-45.00" next to somebody's name is
 * a number the reader has to decode; "You owe ₹45" is the answer they came for. Every balance in
 * this app is rendered through {@link balanceTone} so the same sign always produces the same
 * sentence and the same colour, and nobody has to remember which way round positive means.
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** Indian digit grouping, two decimals, always. `₹1,23,456.00`, not `₹123,456`. */
export function formatMoney(amount) {
  const value = Number(amount ?? 0);
  return Number.isFinite(value) ? INR.format(value) : INR.format(0);
}

/** The same, minus trailing `.00`, for tight spots like a chip. */
export function formatMoneyCompact(amount) {
  const text = formatMoney(amount);
  return text.endsWith('.00') ? text.slice(0, -3) : text;
}

/**
 * What a signed balance means, in words the reader does not have to decode.
 *
 * Positive means the group owes them. `settled` is its own state rather than "₹0.00" because
 * zero is the good outcome and deserves to look like one instead of like a number.
 */
export function balanceTone(balance, { self = false } = {}) {
  const value = Number(balance ?? 0);
  if (!value) {
    return { kind: 'settled', label: self ? 'You are settled up' : 'Settled up', amount: null };
  }
  if (value > 0) {
    return {
      kind: 'owed',
      label: self ? 'You are owed' : 'Is owed',
      amount: formatMoney(value),
    };
  }
  return {
    kind: 'owes',
    label: self ? 'You owe' : 'Owes',
    amount: formatMoney(Math.abs(value)),
  };
}

/** Green when you are up, amber when you are down, muted when square. */
export function balanceColor(balance, T) {
  const value = Number(balance ?? 0);
  if (!value) return T.textMuted;
  return value > 0 ? '#10b981' : '#f59e0b';
}

/* ============================== dates ============================== */

const DAY = 86_400_000;

/** `Today`, `Yesterday`, `12 Sep`, or `12 Sep 2025` once the year stops being obvious. */
export function formatExpenseDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';

  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  const days = Math.round((midnight - date) / DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === midnight.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Groups the feed under date headings, preserving the order the server sent. */
export function groupExpensesByDate(expenses = []) {
  const buckets = [];
  for (const expense of expenses) {
    const label = formatExpenseDate(expense.expenseDate);
    const last = buckets.at(-1);
    if (last && last.label === label) last.items.push(expense);
    else buckets.push({ label, items: [expense] });
  }
  return buckets;
}

export function formatSettledAt(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/* ============================== people ============================== */

/** Initials for an avatar. Two letters at most, because three stop being readable at 32px. */
export function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts.at(-1)[0]).toUpperCase();
}

/**
 * A stable colour per member, so the same person is the same colour everywhere in a group.
 *
 * Derived from the id rather than stored: an avatar tint is not worth a column, and a hash keeps
 * it consistent across the roster, the expense rows and the settle-up plan without any
 * coordination between them.
 */
const AVATAR_COLORS = [
  '#ec4899', '#8b5cf6', '#0ea5e9', '#10b981',
  '#f59e0b', '#ef4444', '#14b8a6', '#6366f1',
];
export function avatarColor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** `Appa`, `Appa and Amma`, `Appa, Amma and 2 others` — never a wall of names. */
export function joinNames(names = []) {
  const list = names.filter(Boolean);
  if (!list.length) return 'nobody';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} other${list.length === 3 ? '' : 's'}`;
}

/** One line describing who paid, for the expense row's subtitle. */
export function paidByLabel(expense, nameOf) {
  const payers = expense?.payers ?? [];
  if (!payers.length) return 'No payer recorded';
  if (payers.length === 1) return `${nameOf(payers[0].memberId)} paid`;
  return `${joinNames(payers.map((p) => nameOf(p.memberId)))} paid`;
}

/* ============================== categories ============================== */

/**
 * Every category on offer, grouped for the "More" menu.
 *
 * Free text on the server, a fixed list here: a picker gets a category onto almost every
 * expense where a text field gets one onto almost none, and the column stays open for anything
 * the list does not cover.
 *
 * Grouped rather than one long alphabetical run, because the groups are how people search —
 * you know you are looking for a travel thing before you know whether you want Train or Taxi.
 */
export const CATEGORY_GROUPS = [
  {
    label: 'Eating',
    items: [
      { value: 'Food', emoji: '🍽️' },
      { value: 'Tea/Coffee', emoji: '☕' },
      { value: 'Breakfast', emoji: '🍳' },
      { value: 'Lunch', emoji: '🍛' },
      { value: 'Dinner', emoji: '🍲' },
      { value: 'Snacks', emoji: '🍿' },
      { value: 'Groceries', emoji: '🛒' },
    ],
  },
  {
    label: 'Getting around',
    items: [
      { value: 'Transport', emoji: '🚗' },
      { value: 'Train', emoji: '🚆' },
      { value: 'Bus', emoji: '🚌' },
      { value: 'Taxi', emoji: '🚕' },
      { value: 'Flight', emoji: '✈️' },
      { value: 'Fuel', emoji: '⛽' },
      { value: 'Parking', emoji: '🅿️' },
    ],
  },
  {
    label: 'Going out',
    items: [
      { value: 'Tickets', emoji: '🎟️' },
      { value: 'Movies', emoji: '🎬' },
      { value: 'Stay', emoji: '🏨' },
      { value: 'Trip', emoji: '🧳' },
      { value: 'Fun', emoji: '🎉' },
    ],
  },
  {
    label: 'Living',
    items: [
      { value: 'Rent', emoji: '🏠' },
      { value: 'Bills', emoji: '🧾' },
      { value: 'Recharge', emoji: '📱' },
      { value: 'Repairs', emoji: '🔧' },
      { value: 'Household', emoji: '🧻' },
    ],
  },
  {
    label: 'Everything else',
    items: [
      { value: 'Shopping', emoji: '🛍️' },
      { value: 'Medical', emoji: '💊' },
      { value: 'Education', emoji: '📚' },
      { value: 'Gifts', emoji: '🎁' },
      { value: 'Personal care', emoji: '💇' },
      { value: 'Pets', emoji: '🐾' },
      { value: 'Other', emoji: '📦' },
    ],
  },
];

/** Flat list, for lookups and for searching the More menu. */
export const EXPENSE_CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.items);

/**
 * The handful shown as chips without opening anything.
 *
 * Eight, and no more. The full list is thirty-odd; laid out as chips it would be the largest
 * thing in the dialog and would push the split section — the part that actually needs
 * attention — below the fold on a phone. Everything else is one tap away behind "More", and a
 * category picked from there is shown alongside these so the selection is never hidden.
 */
export const COMMON_CATEGORIES = [
  'Food', 'Tea/Coffee', 'Breakfast', 'Groceries',
  'Transport', 'Train', 'Tickets', 'Bills',
].map((value) => EXPENSE_CATEGORIES.find((c) => c.value === value));

export const categoryEmoji = (category) =>
  EXPENSE_CATEGORIES.find((c) => c.value === category)?.emoji ?? '📦';

export const GROUP_CATEGORIES = ['Home', 'Trip', 'Flatmates', 'Family', 'Friends', 'Other'];

/**
 * Icons a ledger can wear, grouped and named.
 *
 * <h2>Why they carry names</h2>
 * An emoji is not searchable. The character is a picture, so a reader typing "temple" or "train"
 * matches nothing unless somebody has written those words down beside it — which is what the
 * {@code name} is for, and the only reason the list is data rather than a string of characters.
 *
 * <p>Grouped for the same reason the expense categories are: you know you want a travel thing
 * before you know whether it is a train or a rickshaw.
 *
 * <p>Curated rather than a whole emoji keyboard. Picking from eighty takes a second; picking from
 * three thousand takes a minute, and half of them render differently on every platform — an icon
 * that is a blank box on somebody else's phone is worse than no icon.
 */
export const GROUP_ICON_GROUPS = [
  {
    label: 'Trips & places',
    items: [
      { emoji: '🧳', name: 'Trip' },
      { emoji: '✈️', name: 'Flight' },
      { emoji: '🏖️', name: 'Beach' },
      { emoji: '🏕️', name: 'Camping' },
      { emoji: '🗺️', name: 'Map' },
      { emoji: '🏔️', name: 'Mountains' },
      { emoji: '🏝️', name: 'Island' },
      { emoji: '🏜️', name: 'Desert' },
      { emoji: '🎢', name: 'Theme park' },
      { emoji: '🏨', name: 'Hotel' },
    ],
  },
  {
    label: 'Getting around',
    items: [
      { emoji: '🚗', name: 'Car' },
      { emoji: '🚆', name: 'Train' },
      { emoji: '🚌', name: 'Bus' },
      { emoji: '🚕', name: 'Taxi' },
      { emoji: '🛺', name: 'Rickshaw' },
      { emoji: '🏍️', name: 'Bike' },
      { emoji: '🚲', name: 'Cycle' },
      { emoji: '⛴️', name: 'Ferry' },
      { emoji: '🚇', name: 'Metro' },
      { emoji: '⛽', name: 'Fuel' },
    ],
  },
  {
    label: 'Home & living',
    items: [
      { emoji: '🏠', name: 'Home' },
      { emoji: '🏘️', name: 'Flatmates' },
      { emoji: '🛋️', name: 'Living room' },
      { emoji: '🛏️', name: 'Bedroom' },
      { emoji: '🔑', name: 'Rent' },
      { emoji: '💡', name: 'Bills' },
      { emoji: '🚿', name: 'Water' },
      { emoji: '🪴', name: 'Plants' },
      { emoji: '🧹', name: 'Chores' },
      { emoji: '🧾', name: 'Receipts' },
    ],
  },
  {
    label: 'Food & drink',
    items: [
      { emoji: '🍽️', name: 'Food' },
      { emoji: '☕', name: 'Coffee' },
      { emoji: '🍛', name: 'Curry' },
      { emoji: '🍕', name: 'Pizza' },
      { emoji: '🍜', name: 'Noodles' },
      { emoji: '🥘', name: 'Cooking' },
      { emoji: '🎂', name: 'Cake' },
      { emoji: '🍺', name: 'Drinks' },
      { emoji: '🍦', name: 'Dessert' },
      { emoji: '🛒', name: 'Groceries' },
    ],
  },
  {
    label: 'People',
    items: [
      { emoji: '👥', name: 'Group' },
      { emoji: '🫂', name: 'Friends' },
      { emoji: '🤝', name: 'One to one' },
      { emoji: '👨‍👩‍👧', name: 'Family' },
      { emoji: '🧑‍🤝‍🧑', name: 'Mates' },
      { emoji: '💍', name: 'Wedding' },
      { emoji: '🎓', name: 'College' },
      { emoji: '👶', name: 'Baby' },
      { emoji: '🐾', name: 'Pets' },
      { emoji: '🎁', name: 'Gifts' },
    ],
  },
  {
    label: 'Money & work',
    items: [
      { emoji: '💼', name: 'Work' },
      { emoji: '🪙', name: 'Savings' },
      { emoji: '💰', name: 'Fund' },
      { emoji: '💳', name: 'Card' },
      { emoji: '🏦', name: 'Bank' },
      { emoji: '📈', name: 'Investments' },
      { emoji: '🧮', name: 'Accounts' },
      { emoji: '🏷️', name: 'Shopping' },
      { emoji: '🛠️', name: 'Repairs' },
      { emoji: '📊', name: 'Budget' },
    ],
  },
  {
    label: 'Fun & sport',
    items: [
      { emoji: '🎉', name: 'Party' },
      { emoji: '🎬', name: 'Movies' },
      { emoji: '🎮', name: 'Games' },
      { emoji: '🎤', name: 'Music' },
      { emoji: '🏏', name: 'Cricket' },
      { emoji: '⚽', name: 'Football' },
      { emoji: '🏸', name: 'Badminton' },
      { emoji: '🎨', name: 'Art' },
      { emoji: '🎸', name: 'Band' },
      { emoji: '🃏', name: 'Cards' },
    ],
  },
  {
    label: 'Festivals & faith',
    items: [
      { emoji: '🛕', name: 'Temple' },
      { emoji: '🕉️', name: 'Om' },
      { emoji: '🪔', name: 'Diya' },
      { emoji: '📿', name: 'Mala' },
      { emoji: '🙏', name: 'Puja' },
      { emoji: '🇮🇳', name: 'India' },
      { emoji: '🎆', name: 'Diwali' },
      { emoji: '🎇', name: 'Fireworks' },
      { emoji: '🪘', name: 'Dhol' },
      { emoji: '🥻', name: 'Sari' },
      { emoji: '💐', name: 'Flowers' },
      { emoji: '🧿', name: 'Nazar' },
    ],
  },
];

/** Flat, for the places that only need "is this one of ours". */
export const GROUP_ICONS = GROUP_ICON_GROUPS.flatMap((g) => g.items.map((i) => i.emoji));

/** Fallback when a group predates the icon column. */
export const groupIcon = (group) => group?.icon || (group?.kind === 'DIRECT' ? '🤝' : '👥');

/* ============================== split methods ============================== */

export const SPLIT_METHODS = [
  { value: 'EQUAL',   label: 'Equally',   hint: 'Everyone pays the same' },
  { value: 'EXACT',   label: 'Amounts',   hint: 'Type what each person owes' },
  { value: 'PERCENT', label: 'Percent',   hint: 'Split by percentage' },
  { value: 'SHARES',  label: 'Shares',    hint: 'Weighted — two shares for a couple' },
];

/** The group's net position, for the list card: how much is moving, not who owes it. */
export function outstandingTotal(members = []) {
  const owed = members.reduce((sum, m) => sum + Math.max(0, Number(m.balance ?? 0)), 0);
  return owed;
}

/**
 * What one expense did to one member, so a row can say "you owe ₹50" instead of only "₹100".
 *
 * `owed` reads the share's **owedBy**, not its beneficiary. That is the distinction the whole
 * app exists for: a parent covering a child's share sees the child's portion in their own "you
 * owe", and the child sees nothing — which is exactly what is true.
 */
export function expenseImpact(expense, memberId) {
  if (!memberId) return { paid: 0, owed: 0, net: 0, involved: false };

  const paid = (expense?.payers ?? [])
    .filter((p) => p.memberId === memberId)
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const owed = (expense?.shares ?? [])
    .filter((s) => s.owedByMemberId === memberId)
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

  const consumed = (expense?.shares ?? []).some((s) => s.beneficiaryMemberId === memberId);

  return { paid, owed, net: paid - owed, involved: paid > 0 || owed > 0 || consumed };
}

/** The trailing line on an expense row: what it means for you, in words. */
export function impactLabel(impact) {
  if (!impact.involved) return { text: 'Not involved', kind: 'settled' };
  if (impact.net > 0) return { text: `You get back ${formatMoney(impact.net)}`, kind: 'owed' };
  if (impact.net < 0) return { text: `You owe ${formatMoney(-impact.net)}`, kind: 'owes' };
  return { text: 'No change for you', kind: 'settled' };
}

/* ============================== the spending report ============================== */

/**
 * An ISO `yyyy-MM-dd` as a *local* date.
 *
 * The `T00:00:00` is load-bearing: `new Date('2026-09-01')` is parsed as UTC and renders as
 * 31 August anywhere west of Greenwich, which would put the first of the month in the previous
 * one. Same reason {@link formatExpenseDate} does it.
 */
const localDate = (iso) => {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `Mon`, `3`, or `Jan` — the label under one bar of the spending chart. */
export function bucketLabel(unit, isoStart) {
  const date = localDate(isoStart);
  if (!date) return '';
  switch (unit) {
    case 'YEAR': return String(date.getFullYear());
    case 'MONTH': return date.toLocaleDateString('en-IN', { month: 'short' });
    case 'WEEKDAY': return date.toLocaleDateString('en-IN', { weekday: 'short' });
    default: return String(date.getDate());
  }
}

/**
 * Which window a report covers: `September 2026`, `2026`, `14–20 Sep 2026`.
 *
 * Always concrete, never "this month". The reader is stepping backwards and forwards through
 * these, and a label that changes meaning depending on today's date is the one thing a date
 * picker must not do.
 */
export function formatReportWindow({ period, from, to } = {}) {
  const start = localDate(from);
  const end = localDate(to);
  if (!start || !end) return '';

  if (period === 'YEAR') return String(start.getFullYear());
  if (period === 'MONTH') {
    return start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  // A week can straddle two months, and occasionally two years, so the start only drops its
  // month when it genuinely shares one with the end.
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startText = sameMonth
    ? String(start.getDate())
    : start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const endText = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startText} – ${endText}`;
}

/** `so far this month`, or `in September 2026` once the period is behind us. */
export function reportCaption(report) {
  if (!report) return '';

  // A range the reader chose has no name to say "so far this ..." about, and no anchors either,
  // so the test below would call every one of them "this month". Its length is the honest
  // description, and it is also the thing the reader is least sure of after picking two dates.
  if (report.period == null) {
    const days = daysBetween(report.from, report.to);
    return days ? `over ${days} ${days === 1 ? 'day' : 'days'}` : '';
  }

  // No next period to step into is the server saying this one has not finished yet.
  const current = report.nextAnchor == null;
  const unit = { WEEK: 'week', MONTH: 'month', YEAR: 'year' }[report.period] ?? 'month';
  return current ? `so far this ${unit}` : `in ${formatReportWindow(report)}`;
}

/** Whole days from one ISO date to another, both ends counted. */
function daysBetween(fromIso, toIso) {
  const start = localDate(fromIso);
  const end = localDate(toIso);
  if (!start || !end) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

/**
 * This period against the one before it, in words.
 *
 * Returns null when there is nothing to compare against — a first month has no "versus", and
 * "up 100%" from zero is a number that sounds like information and is not.
 */
export function spendingTrend(total, previousTotal, period = 'MONTH') {
  const now = Number(total ?? 0);
  const before = Number(previousTotal ?? 0);
  if (!before) return null;

  const unit = { WEEK: 'week', MONTH: 'month', YEAR: 'year' }[period] ?? 'month';
  const delta = now - before;
  if (!delta) return { direction: 'flat', percent: 0, label: `same as last ${unit}` };

  const percent = Math.round(Math.abs(delta / before) * 100);
  return {
    direction: delta > 0 ? 'up' : 'down',
    percent,
    label: `${percent}% ${delta > 0 ? 'more' : 'less'} than last ${unit}`,
  };
}

/* ============================== the ledger list ============================== */

/**
 * How long ago something last moved, in the fewest words that are still true.
 *
 * Deliberately coarse. A ledger that was touched on Tuesday is "3 days ago", not "3 days and
 * 4 hours" — the reader is scanning a list for the one that needs them, and precision they
 * cannot act on is just more to read.
 */
export function lastActivity(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const days = Math.floor((Date.now() - then.getTime()) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'a year ago' : `${years} years ago`;
}

/**
 * Splits the ledger list into the two groups the screen is built around.
 *
 * <p>The old list sorted by recent activity and filtered by kind, which is the wrong axis: with
 * four of five ledgers settled, "People or groups?" is not the question anybody opens this app
 * with. "Does anything need me?" is. Anything with a balance comes first, biggest first, and
 * everything square folds away behind one line.
 */
export function splitLedgers(groups = []) {
  const shared = groups.filter((g) => g.kind !== 'PERSONAL');
  const live = shared.filter((g) => !g.archived);

  const owing = live.filter((g) => Number(g.myBalance ?? 0) !== 0);
  return {
    personal: groups.find((g) => g.kind === 'PERSONAL') ?? null,
    // Biggest first: at a glance the top row is the one worth acting on.
    needsYou: owing.sort((a, b) => Math.abs(Number(b.myBalance)) - Math.abs(Number(a.myBalance))),
    settled: live.filter((g) => Number(g.myBalance ?? 0) === 0),
    archived: shared.filter((g) => g.archived),
    net: live.reduce((sum, g) => sum + Number(g.myBalance ?? 0), 0),
  };
}
