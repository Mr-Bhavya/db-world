import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/cinema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a full TMDB image URL from a path. */
export const tmdbImg = (path, quality = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${quality}${path}` : null;

/** Unwrap ApiResponse<T> → T */
const unwrap = (r) => r.data?.data ?? r.data;

// ─── Page Rails ───────────────────────────────────────────────────────────────

/** GET /api/cinema/{page}  → List<RailDto> (metadata only, no records) */
export const fetchPageRails = (page, category) =>
  axiosInstance.get(`${BASE}/${page}`, { params: { category } }).then(unwrap);

/** GET /api/cinema/{page}/categories  → List<GenreDto> */
export const fetchPageCategories = (page) =>
  axiosInstance.get(`${BASE}/${page}/categories`).then(unwrap);

// ─── Rail Records (lazy / paginated) ──────────────────────────────────────────

/**
 * GET /api/cinema/rails/{railId}/records
 * → RailPageDto { railId, page, size, hasNext, records: RailRecordDto[] }
 */
export const fetchRailPage = (railId, page = 0, size = 20, category) =>
  axiosInstance
    .get(`${BASE}/rails/${railId}/records`, { params: { page, size, category } })
    .then(unwrap);

// ─── Catalog ──────────────────────────────────────────────────────────────────

/** GET /api/cinema/catalog/{id}  → RecordDto */
export const fetchRecord = (id) =>
  axiosInstance.get(`${BASE}/catalog/${id}`).then(unwrap);

/** GET /api/cinema/catalog/search?q=&page=&size=  → Page<RecordDto> */
export const searchRecords = (q, page = 0, size = 20) =>
  axiosInstance
    .get(`${BASE}/catalog/search`, { params: { q, page, size } })
    .then(unwrap);

/** GET /api/cinema/catalog/autocomplete?q=  → List<RecordAutocompleteDto> */
export const autocomplete = (q) =>
  axiosInstance
    .get(`${BASE}/catalog/autocomplete`, { params: { q } })
    .then(unwrap);

// ─── Interactions ─────────────────────────────────────────────────────────────

/** GET /api/cinema/interactions?userId=&recordId=  → InteractionDto */
export const fetchInteraction = (userId, recordId) =>
  axiosInstance
    .get(`${BASE}/interactions`, { params: { userId, recordId } })
    .then(unwrap);

/**
 * POST /api/cinema/interactions/batch?userId=  body: Long[]
 * → List<InteractionDto>
 */
export const fetchBatchInteractions = (userId, recordIds) =>
  axiosInstance
    .post(`${BASE}/interactions/batch`, recordIds, { params: { userId } })
    .then(unwrap);

// Axios DELETE only takes (url, config) — no data arg like POST.
// Backend reads userId from JWT, so only recordId is needed as a param.
const interactionReq = (method, type, recordId) =>
  method === 'delete'
    ? axiosInstance.delete(`${BASE}/interactions/${type}`, { params: { recordId } })
    : axiosInstance.post(`${BASE}/interactions/${type}`, null, { params: { recordId } });

export const addWatchlist    = (rid) => interactionReq('post',   'watchlist', rid);
export const removeWatchlist = (rid) => interactionReq('delete', 'watchlist', rid);
export const addLike         = (rid) => interactionReq('post',   'like',      rid);
export const removeLike      = (rid) => interactionReq('delete', 'like',      rid);
export const addWatched      = (rid) => interactionReq('post',   'watched',   rid);
export const removeWatched   = (rid) => interactionReq('delete', 'watched',   rid);
export const addLove         = (rid) => interactionReq('post',   'love',      rid);
export const removeLove      = (rid) => interactionReq('delete', 'love',      rid);

export const updateProgress = (userId, recordId, progress) =>
  axiosInstance.post(`${BASE}/interactions/progress`, null, {
    params: { userId, recordId, progress },
  });

// ─── User Reviews ─────────────────────────────────────────────────────────────

/** GET /api/cinema/reviews/record/{recordId} → List<UserReviewDto> */
export const fetchUserReviews = (recordId) =>
  axiosInstance.get(`${BASE}/reviews/record/${recordId}`).then(unwrap);

/** GET /api/cinema/reviews/mine?recordId= → UserReviewDto | null */
export const fetchMyReview = (recordId) =>
  axiosInstance.get(`${BASE}/reviews/mine`, { params: { recordId } }).then(unwrap);

/** POST /api/cinema/reviews?recordId= + body {rating, content} → UserReviewDto */
export const upsertReview = (recordId, rating, content) =>
  axiosInstance.post(`${BASE}/reviews`, { rating, content }, { params: { recordId } }).then(unwrap);

/** DELETE /api/cinema/reviews?recordId= */
export const deleteReview = (recordId) =>
  axiosInstance.delete(`${BASE}/reviews`, { params: { recordId } }).then(unwrap);
