import axiosInstance from '@shared/components/ui/utils/AxiosInstants';

const BASE = '/api/cinema';

// ─── Watch Progress ───────────────────────────────────────────────────────────

export const saveWatchProgress = (fileId, { recordId, positionMs, durationMs, audioLang, subLang }) =>
  axiosInstance.put(`${BASE}/progress/${fileId}`, null, {
    params: { recordId, positionMs, durationMs, audioLang, subLang },
  }).then(r => r.data);

export const getWatchProgress = (fileId) =>
  axiosInstance.get(`${BASE}/progress/${fileId}`).then(r => r.data?.data ?? null);

export const getRecentProgress = (days = 30) =>
  axiosInstance.get(`${BASE}/progress`, { params: { days } }).then(r => r.data?.data ?? []);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a full TMDB image URL from a path. */
export const tmdbImg = (path, quality = 'original') =>
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

/** GET /api/cinema/catalog/{id}/similar?limit=  → List<SearchRecordDto>
 *  Lightweight "More Like This" — records sharing the primary genre,
 *  excluding the source record. */
export const fetchSimilarRecords = (id, limit = 12) =>
  axiosInstance.get(`${BASE}/catalog/${id}/similar`, { params: { limit } }).then(unwrap);

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

// ─── Watchlist Rail ───────────────────────────────────────────────────────────

/**
 * GET /api/cinema/interactions/watchlist/records?page=0&size=50
 * → RailPageDto { records: RailRecordDto[], hasNext, page, size }
 */
export const fetchWatchlistRecords = (page = 0, size = 50) =>
  axiosInstance
    .get(`${BASE}/interactions/watchlist/records`, { params: { page, size } })
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

// ─── Notifications ────────────────────────────────────────────────────────────

/** GET /api/notifications?limit=N → UserNotificationDto[] */
export const fetchNotifications = (limit = 30) =>
  axiosInstance.get('/api/notifications', { params: { limit } }).then(unwrap);

/** GET /api/notifications/unread-count → number */
export const fetchUnreadCount = () =>
  axiosInstance.get('/api/notifications/unread-count')
    .then(r => r.data?.data?.count ?? 0);

/** PUT /api/notifications/mark-read */
export const markNotificationsRead = () =>
  axiosInstance.put('/api/notifications/mark-read').then(unwrap);

// ─── Media Requests ───────────────────────────────────────────────────────────
// Kinds: NEW_FILES (empty state), HIGHER_QUALITY, LOWER_QUALITY.

/** POST /api/cinema/media-requests/{recordId}/vote?kind=KIND → { recordId, kind, voteCount, hasMyVote } */
export const toggleMediaRequestVote = (recordId, kind = 'NEW_FILES') =>
  axiosInstance
    .post(`${BASE}/media-requests/${recordId}/vote`, null, { params: { kind } })
    .then(unwrap);

/** GET /api/cinema/media-requests/mine → [{ recordId, kind }] pending requests caller voted for */
export const fetchMyMediaRequests = () =>
  axiosInstance.get(`${BASE}/media-requests/mine`).then(unwrap);

// ─── Persons ──────────────────────────────────────────────────────────────────

/** GET /api/cinema/persons/{id} → PersonDetailDto (bio + filmography) */
export const fetchPersonDetail = (id) =>
  axiosInstance.get(`${BASE}/persons/${id}`).then(unwrap);

// ─── Catalog Ingest Requests (new titles not yet in the catalog) ─────────────

/** GET /api/cinema/tmdb/search?type=MOVIE&query=... → TmdbSearchItemDto[] */
export const searchTmdbForRequest = (type, query, year) =>
  axiosInstance
    .get(`${BASE}/tmdb/search`, { params: { type, query, year } })
    .then(unwrap);

/**
 * POST /api/cinema/catalog-requests/vote
 * body: { tmdbId, mediaType: 'MOVIE'|'TV_SERIES', title, posterPath?, releaseYear?, note? }
 */
export const toggleCatalogIngestVote = (payload) =>
  axiosInstance.post(`${BASE}/catalog-requests/vote`, payload).then(unwrap);

/** GET /api/cinema/catalog-requests/mine → [{ tmdbId, mediaType }] */
export const fetchMyCatalogRequests = () =>
  axiosInstance.get(`${BASE}/catalog-requests/mine`).then(unwrap);

// ─── Admin: Catalog Ingest Requests ──────────────────────────────────────────

export const fetchAdminCatalogRequests = (status) =>
  axiosInstance
    .get(`${BASE}/admin/catalog-requests`, { params: status ? { status } : {} })
    .then(unwrap);

export const ingestCatalogRequest = (id) =>
  axiosInstance.post(`${BASE}/admin/catalog-requests/${id}/ingest`).then(unwrap);

export const dismissCatalogRequest = (id, reason) =>
  axiosInstance
    .post(`${BASE}/admin/catalog-requests/${id}/dismiss`, { reason: reason ?? null })
    .then(unwrap);

export const reopenCatalogRequest = (id) =>
  axiosInstance.post(`${BASE}/admin/catalog-requests/${id}/reopen`).then(unwrap);

// ─── Admin: Media Requests ────────────────────────────────────────────────────

/** GET /api/cinema/admin/media-requests?status=PENDING → MediaRequestDto[] */
export const fetchAdminMediaRequests = (status) =>
  axiosInstance
    .get(`${BASE}/admin/media-requests`, { params: status ? { status } : {} })
    .then(unwrap);

/** POST /api/cinema/admin/media-requests/{id}/fulfill */
export const fulfillMediaRequest = (id) =>
  axiosInstance.post(`${BASE}/admin/media-requests/${id}/fulfill`).then(unwrap);

/** POST /api/cinema/admin/media-requests/{id}/dismiss — body: { reason?: string } */
export const dismissMediaRequest = (id, reason) =>
  axiosInstance
    .post(`${BASE}/admin/media-requests/${id}/dismiss`, { reason: reason ?? null })
    .then(unwrap);

/** POST /api/cinema/admin/media-requests/{id}/reopen — undo fulfill/dismiss. */
export const reopenMediaRequest = (id) =>
  axiosInstance.post(`${BASE}/admin/media-requests/${id}/reopen`).then(unwrap);
