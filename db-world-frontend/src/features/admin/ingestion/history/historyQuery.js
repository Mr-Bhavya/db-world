export const HISTORY_STATUSES = ['SUCCESS', 'FAILED', 'CANCELLED', 'PAUSED', 'DOWNLOADING', 'PROCESSING', 'QUEUED'];

/** Request params for GET /api/ingestion/history — blank filters are omitted. */
export function toHistoryParams({ page = 0, size = 25, q, status } = {}) {
  const params = { page: Math.max(0, page | 0), size: Math.min(100, Math.max(1, size | 0)) };
  const term = typeof q === 'string' ? q.trim() : '';
  if (term) params.q = term;
  if (status && HISTORY_STATUSES.includes(status)) params.status = status;
  return params;
}

const EMPTY_PAGE = Object.freeze({ content: [], totalElements: 0, totalPages: 0, counts: { TOTAL: 0 } });

/** Normalises the paged response; tolerates the legacy plain-array shape. */
export function normalizeHistoryPage(data) {
  if (!data) return EMPTY_PAGE;
  if (Array.isArray(data)) {
    const counts = { TOTAL: data.length };
    data.forEach((r) => { if (r?.status) counts[r.status] = (counts[r.status] ?? 0) + 1; });
    return { content: data, totalElements: data.length, totalPages: data.length ? 1 : 0, counts };
  }
  const content = Array.isArray(data.content) ? data.content : [];
  const totalElements = Number.isFinite(data.totalElements) ? data.totalElements : content.length;
  return {
    content,
    totalElements,
    totalPages: Number.isFinite(data.totalPages) ? data.totalPages : (content.length ? 1 : 0),
    counts: { TOTAL: totalElements, ...(data.counts ?? {}) },
  };
}
