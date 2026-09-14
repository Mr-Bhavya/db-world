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
 * The category list offered in the dialog.
 *
 * Free text on the server, a fixed menu here: a picker of eight gets a category onto almost
 * every expense, where a text field gets one onto almost none, and the column stays open for
 * anything the menu does not cover.
 */
export const EXPENSE_CATEGORIES = [
  { value: 'Food', emoji: '🍽️' },
  { value: 'Groceries', emoji: '🛒' },
  { value: 'Travel', emoji: '✈️' },
  { value: 'Transport', emoji: '🚗' },
  { value: 'Home', emoji: '🏠' },
  { value: 'Bills', emoji: '🧾' },
  { value: 'Fun', emoji: '🎬' },
  { value: 'Other', emoji: '📦' },
];

export const categoryEmoji = (category) =>
  EXPENSE_CATEGORIES.find((c) => c.value === category)?.emoji ?? '📦';

export const GROUP_CATEGORIES = ['Home', 'Trip', 'Flatmates', 'Family', 'Friends', 'Other'];

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
