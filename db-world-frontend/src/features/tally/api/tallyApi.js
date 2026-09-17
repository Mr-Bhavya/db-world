import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/tally';

/**
 * Every endpoint answers the shared `ApiResponse` envelope, so the payload is one level down.
 * The `?? r.data` fallback keeps this working for any handler that ever returns a bare body.
 */
const unwrap = (r) => r.data?.data ?? r.data;

/**
 * A retry token, so a request that times out after the server committed can be re-sent safely.
 *
 * <p>Generated on the client and held for the life of one submit, not one request: the point is
 * that the second attempt carries the SAME key as the first. Expenses and settlements both need
 * it, and settlements need it most — settling is one-sided, so a duplicate does not add a
 * harmless row, it moves the balance by the full amount again.
 */
export const newIdempotencyKey = () =>
  (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/* ============================== groups ============================== */

export const fetchGroups = () => axiosInstance.get(`${BASE}/groups`).then(unwrap);

export const fetchGroup = (groupId) =>
  axiosInstance.get(`${BASE}/groups/${groupId}`).then(unwrap);

export const createGroup = (body) => axiosInstance.post(`${BASE}/groups`, body).then(unwrap);

/**
 * Starts a running total with one person — or returns the one that already exists.
 *
 * The server refuses to create a second ledger with somebody you already share one with, so
 * this is safe to call from a "split with" button without checking first.
 */
export const createDirectLedger = (body) =>
  axiosInstance.post(`${BASE}/groups/direct`, body).then(unwrap);

/**
 * Your own spending ledger — starting one if you do not have it yet.
 *
 * A POST because it may create, idempotent because it returns the one you already have. Safe
 * to call from a button without checking first.
 */
export const openPersonalLedger = () =>
  axiosInstance.post(`${BASE}/groups/personal`).then(unwrap);

/**
 * A page of the group's history, newest first.
 *
 * Readable for archived groups too -- that history is most of the reason to archive rather
 * than delete. Both cursor halves travel together or not at all.
 */
export const fetchActivity = (groupId, { cursorAt, cursorId, size } = {}) =>
  axiosInstance.get(`${BASE}/groups/${groupId}/activity`, {
    params: {
      cursorAt: cursorAt && cursorId ? cursorAt : undefined,
      cursorId: cursorAt && cursorId ? cursorId : undefined,
      size: size || undefined,
    },
  }).then(unwrap);

export const updateGroup = (groupId, body) =>
  axiosInstance.patch(`${BASE}/groups/${groupId}`, body).then(unwrap);

/* ============================== members ============================== */

/**
 * Finds db-world accounts to add.
 *
 * Deliberately the existing shared endpoint rather than a tally-specific one: there should be
 * exactly one place in the app that decides what one user may learn about another, and adding
 * a second would mean keeping two of them in agreement forever.
 */
export const searchUsers = (q, limit = 6) =>
  axiosInstance.get('/api/user/search', { params: { q, limit } }).then(unwrap);

export const addMember = (groupId, body) =>
  axiosInstance.post(`${BASE}/groups/${groupId}/members`, body).then(unwrap);

export const updateMember = (groupId, memberId, body) =>
  axiosInstance.patch(`${BASE}/groups/${groupId}/members/${memberId}`, body).then(unwrap);

export const removeMember = (groupId, memberId) =>
  axiosInstance.delete(`${BASE}/groups/${groupId}/members/${memberId}`).then(unwrap);

export const claimMember = (groupId, memberId) =>
  axiosInstance.post(`${BASE}/groups/${groupId}/members/${memberId}/claim`).then(unwrap);

/* ============================== expenses ============================== */

/**
 * One page of the expense feed.
 *
 * Both cursor halves travel together or not at all — the server treats a half cursor as no
 * cursor, and sending one alone would silently restart the feed from the top.
 */
export const fetchExpenses = (groupId, { cursorDate, cursorId, size } = {}) =>
  axiosInstance.get(`${BASE}/groups/${groupId}/expenses`, {
    params: {
      cursorDate: cursorDate && cursorId ? cursorDate : undefined,
      cursorId: cursorDate && cursorId ? cursorId : undefined,
      size: size || undefined,
    },
  }).then(unwrap);

export const createExpense = (groupId, body) =>
  axiosInstance.post(`${BASE}/groups/${groupId}/expenses`, body).then(unwrap);

export const fetchExpense = (expenseId) =>
  axiosInstance.get(`${BASE}/expenses/${expenseId}`).then(unwrap);

/** A correction: the server voids the original and posts a replacement with a new id. */
export const replaceExpense = (expenseId, body) =>
  axiosInstance.put(`${BASE}/expenses/${expenseId}`, body).then(unwrap);

/** Puts a removed expense back, as a fresh copy. The removed one stays removed. */
export const restoreExpense = (expenseId) =>
  axiosInstance.post(`${BASE}/expenses/${expenseId}/restore`).then(unwrap);

export const voidExpense = (expenseId) =>
  axiosInstance.delete(`${BASE}/expenses/${expenseId}`).then(unwrap);

/* ============================== settlements ============================== */

/* ============================== loans ============================== */

/**
 * Every loan across every ledger, not scoped to one.
 *
 * "Who owes me money" is asked about everybody at once -- asking it per ledger is how you forget
 * the one you have not opened in three months.
 */
export const fetchLoans = () => axiosInstance.get(`${BASE}/loans`).then(unwrap);

/** The loans in one ledger, for its own tab. */
export const fetchGroupLoans = (groupId) =>
  axiosInstance.get(`${BASE}/groups/${groupId}/loans`).then(unwrap);

export const createLoan = (groupId, body) =>
  axiosInstance.post(`${BASE}/groups/${groupId}/loans`, body).then(unwrap);

/* ============================== settlements ============================== */

export const fetchSettlements = (groupId) =>
  axiosInstance.get(`${BASE}/groups/${groupId}/settlements`).then(unwrap);

export const recordSettlement = (groupId, body) =>
  axiosInstance.post(`${BASE}/groups/${groupId}/settlements`, body).then(unwrap);

export const reverseSettlement = (settlementId) =>
  axiosInstance.delete(`${BASE}/settlements/${settlementId}`).then(unwrap);

/** Suggested transfers. A GET, and it writes nothing — recording one is a normal settlement. */
export const fetchSettleUpPlan = (groupId) =>
  axiosInstance.get(`${BASE}/groups/${groupId}/settle-up`).then(unwrap);

/* ============================== reports ============================== */

/**
 * A period and an anchor, or an explicit range.
 *
 * <p>The two are never sent together: the server takes explicit dates over a period when it gets
 * both, but sending an anchor alongside them would be the client saying two different things and
 * relying on the server to pick — and the one it picks is not written down anywhere the client
 * can see.
 */
const reportParams = (period, anchor, from, to) => (from && to
  ? { period, from, to }
  : { period, ...(anchor ? { anchor } : {}) });

/**
 * What the caller consumed over one week, month or year — across every ledger at once.
 *
 * `anchor` is any date inside the period (`yyyy-MM-dd`), not its first day: the server decides
 * which week or month that day belongs to, so stepping back a month is one date to send rather
 * than calendar arithmetic done twice, differently, on both sides. Omit it for the current
 * period.
 */
export const fetchSpendingReport = ({ period = 'MONTH', anchor, from, to } = {}) =>
  axiosInstance
    .get(`${BASE}/reports/spending`, { params: reportParams(period, anchor, from, to) })
    .then(unwrap);

/**
 * What one group spent over a period, and who carried it.
 *
 * A different report from {@link fetchSpendingReport}, not the same one narrowed: the figures
 * are the group's whole spend and a paid-versus-consumed split per member, where the personal
 * one is only ever your own share.
 */
export const fetchGroupReport = (groupId, { period = 'MONTH', anchor, from, to } = {}) =>
  axiosInstance
    .get(`${BASE}/reports/groups/${groupId}`, { params: reportParams(period, anchor, from, to) })
    .then(unwrap);


/* ============================== Splitwise import ============================== */

/**
 * Reads a Splitwise export and reports what is in it. Writes nothing.
 *
 * The CSV goes as a JSON string rather than a multipart upload: CapacitorHttp corrupts binary
 * multipart bodies, so every upload the phone app can reach otherwise needs a base64 twin.
 * A CSV is text, so this one endpoint works on web and in the app with no encoding either side.
 */
export const previewSplitwise = (csv) =>
  axiosInstance.post(`${BASE}/import/splitwise/preview`, { csv }).then(unwrap);

/** Commits the export into a brand new group, or saves nothing at all. */
export const importSplitwise = (body) =>
  axiosInstance.post(`${BASE}/import/splitwise`, body).then(unwrap);
