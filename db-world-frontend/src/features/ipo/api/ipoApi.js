import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/ipo';
const unwrap = (r) => r.data?.data ?? r.data;

/**
 * List IPOs.
 * - status: canonical upcoming|open|closed|listed; omitted when falsy (= all).
 * - type: mainboard|sme; omitted when falsy or 'all' (= all).
 * - sort: date (default) | gmp | subscription — always sent.
 */
export const getIpos = ({ status, type, sort = 'date' } = {}) => {
  const params = { sort };
  if (status) params.status = status;
  if (type && type !== 'all') params.type = type;
  return axiosInstance.get(BASE, { params }).then(unwrap);
};

export const getIpo = (id) =>
  axiosInstance.get(`${BASE}/${id}`).then(unwrap);

export const getGmpHistory = (id) =>
  axiosInstance.get(`${BASE}/${id}/gmp-history`).then(unwrap);

export const getSubscriptionHistory = (id) =>
  axiosInstance.get(`${BASE}/${id}/subscription-history`).then(unwrap);

/** P&L series (ascending by fiscal year), ₹ crore. Heavy/optional detail — fetched
 * on demand by the detail page's financials section, not with the rest of the detail. */
export const getFinancials = (id) =>
  axiosInstance.get(`${BASE}/${id}/financials`).then(unwrap);

/**
 * Applicant-level "My IPOs" — per-user, login-gated (@AnyRole). The server stores only a
 * PAN's last-4 characters; `saveApplication` sends the full `pan` the user typed (never
 * persisted as-is), and every response only ever carries back `panLast4`.
 */

/** The caller's saved application for this IPO, or `null` when none exists yet — the server
 * returns `data: null` here rather than a 404, so we must NOT fall back to the raw envelope
 * (unlike `unwrap`, which would resolve a null `data` to the whole response body). */
export const getMyApplication = (id) =>
  axiosInstance.get(`${BASE}/${id}/application`).then((r) => r.data?.data ?? null);

export const saveApplication = (id, body) =>
  axiosInstance.post(`${BASE}/${id}/application`, body).then(unwrap);

export const deleteApplication = (id) =>
  axiosInstance.delete(`${BASE}/${id}/application`).then((r) => r.data);

/** Every IPO the caller has saved an application for, each joined with a light IPO summary. */
export const getMyApplications = () =>
  axiosInstance.get(`${BASE}/my/applications`).then((r) => r.data?.data ?? []);
