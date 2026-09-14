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

export const voidExpense = (expenseId) =>
  axiosInstance.delete(`${BASE}/expenses/${expenseId}`).then(unwrap);

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
