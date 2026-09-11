import React from "react";
import { Box, CircularProgress, Button } from "@mui/material";

/* =========================
 * AUTH / USER MESSAGES
 * ========================= */
export const RE_LOGIN = " Please Relogin";

/* =========================
 * API ENDPOINTS
 * ========================= */
export const ADD_RECORD_API = "/api/media/add/record";
export const MIRROR_API = "/api/media/mirror";

export const ADD_USER_API = "/api/auth/add";

export const ADD_PASSWORD_API = "/api/user/add_password";
export const UPDATE_PASSWORD_API = "/api/user/update_password";
export const DELETE_PASSWORD_API = "/api/user/delete_password";
export const DELETE_HOST_API = "/api/user/delete_host";

export const FIND_ALL_USERS_API = "/api/user/findAll";
export const DELETE_USER_API = "/api/user/delete";
export const EDIT_USER_API = "/api/user/edit";
export const USER_ROLE_API = "/api/user/user_role";
export const UPDATE_USER_ROLE_API = "/api/user/update_user_role";

export const VALIDATE_TOKEN_API = "/api/validateToken";

/* =========================
 * ICON / ASSET URLS
 * ========================= */
export const DELETE_ICON_URL =
  "https://img.icons8.com/material-rounded/48/null/delete-forever.png";

export const VIEW_USER_ICON_URL =
  "https://img.icons8.com/material-sharp/24/null/contract-job.png";

export const DB_WORLD_TEAL_SVG_ICON = "@assets/images/db-circle-icon.webp";

/* =========================
 * ROUTES
 * ========================= */

/**
 * Path prefix every app route hangs off. EMPTY on purpose.
 *
 * Everything used to sit under `/db-world`, which repeated the brand already in the
 * hostname — `db-world.in/db-world/db-cinema/browse`. A prefix like that earns its
 * keep when one domain hosts several apps under different paths; here it only ever
 * made every URL longer and split the home page across two of them (`/` was a
 * client-side redirect to `/db-world`, and Google indexed the redirect rather than
 * the page).
 *
 * Kept as a named constant rather than inlined so the derived routes below stay one
 * edit away from moving again, and so the intent is visible instead of looking like
 * somebody forgot the prefix.
 *
 * Old URLs are NOT abandoned: nginx 301s `/db-world/*` to the same path without it,
 * and `LegacyPrefixRedirect` in App.jsx does the same client-side for deep links
 * arriving from an older Android build.
 */
const APP_BASE = "";

/** The hub. `/`, not `APP_BASE` — an empty string is not a usable route or link target. */
export const DB_WORLD_HOME_ROUTE = "/";

/** The old prefix, retained ONLY so the legacy redirect and its tests can name it. */
export const LEGACY_PATH_PREFIX = "/db-world";

export const DB_CINEMA_ROUTE = `${APP_BASE}/db-cinema`;
export const DB_CINEMA_BROWSE_ROUTE = `${DB_CINEMA_ROUTE}/browse`;
export const DB_CINEMA_DOWNLOAD_PROGRESS_ROUTE =
  `${DB_CINEMA_ROUTE}/download-progress`;
export const DB_CINEMA_MOVIES_ROUTE = `${DB_CINEMA_ROUTE}/movie`;
export const DB_CINEMA_SERIES_ROUTE = `${DB_CINEMA_ROUTE}/tv-shows`;
// Genre landing pages: the section page filtered to one genre, e.g.
// /db-cinema/movie/genre/28-action. Two path segments after the section, so
// they can never collide with the one-segment detail route below.
export const DB_CINEMA_BROWSE_GENRE_ROUTE = `${DB_CINEMA_BROWSE_ROUTE}/genre/:genreSlug`;
export const DB_CINEMA_MOVIES_GENRE_ROUTE = `${DB_CINEMA_MOVIES_ROUTE}/genre/:genreSlug`;
export const DB_CINEMA_SERIES_GENRE_ROUTE = `${DB_CINEMA_SERIES_ROUTE}/genre/:genreSlug`;
export const DB_MOVIE_DETIALS_ROUTE = `${DB_CINEMA_ROUTE}/movie/:title`;
export const DB_SERIES_DETIALS_ROUTE = `${DB_CINEMA_ROUTE}/series/:title`;
export const DB_CINEMA_COLLECTION_ROUTE = `${DB_CINEMA_ROUTE}/collection/:collectionId`;
export const DB_RECORD_MEDIA_FILES_ROUTE =
  `${DB_CINEMA_ROUTE}/record/:recordId/media-files`;
export const DB_DOWNLOAD_QUEUE_ROUTE = `${DB_CINEMA_ROUTE}/downloads`;
export const DB_PLAYER_ROUTE = `${DB_CINEMA_ROUTE}/player`;
// The player route carries the file id so URLs are unique + shareable + refreshable.
export const DB_PLAYER_ROUTE_PATTERN = `${DB_PLAYER_ROUTE}/:mediaFileId`;
export const playerPath = (mediaFileId) => `${DB_PLAYER_ROUTE}/${encodeURIComponent(mediaFileId ?? '')}`;
export const DB_PLAYER_DEMO_ROUTE = `${DB_PLAYER_ROUTE}/demo`;

// Legal / informational pages. Public, and required by AdSense before a site can
// be approved — see docs/adsense-setup.md.
// Reached from an emailed link, so these live at the top level rather than under
// /db-world — a URL a mail client will linkify should be as short as possible.
export const RESET_PASSWORD_ROUTE = "/reset-password";
export const VERIFY_EMAIL_ROUTE   = "/verify-email";

export const DB_ABOUT_ROUTE   = `${APP_BASE}/about`;
export const DB_PRIVACY_ROUTE = `${APP_BASE}/privacy`;
export const DB_TERMS_ROUTE   = `${APP_BASE}/terms`;
export const DB_CONTACT_ROUTE = `${APP_BASE}/contact`;

export const DB_WEATHER_ROUTE = `${APP_BASE}/db-weather`;
export const DB_GAMES_ROUTE = `${APP_BASE}/db-games`;
export const DB_GAMES_TIC_TAC_TOE_ROUTE = `${DB_GAMES_ROUTE}/tic-tac-toe`;
export const DB_GAMES_SNAKE_ROUTE = `${DB_GAMES_ROUTE}/snake`;
export const DB_GAMES_MEMORY_MATCH_ROUTE = `${DB_GAMES_ROUTE}/memory-match`;
export const DB_GAMES_2048_ROUTE = `${DB_GAMES_ROUTE}/2048`;
export const DB_GAMES_MINESWEEPER_ROUTE = `${DB_GAMES_ROUTE}/minesweeper`;
export const DB_GAMES_CONNECT_FOUR_ROUTE = `${DB_GAMES_ROUTE}/connect-four`;

export const DB_PASSWORD_MANAGER_ROUTE =
  `${APP_BASE}/db-password-manager`;
export const DB_GENERATE_PASSWORD_ROUTE =
  `${DB_PASSWORD_MANAGER_ROUTE}/generate-password`;
export const DB_ADD_PASSWORD_ROUTE =
  `${DB_PASSWORD_MANAGER_ROUTE}/add-password`;
export const DB_VIEW_PASSWORD_ROUTE =
  `${DB_PASSWORD_MANAGER_ROUTE}/view-password`;

export const LOGIN_ROUTE = `${APP_BASE}/login`;
export const LOGOUT_ROUTE = `${APP_BASE}/logout`;
export const REGISTRATION_ROUTE = `${APP_BASE}/registration`;

export const USER_PROFILE_ROUTE =
  `${APP_BASE}/user-profile`;
export const EDIT_USER_PROFILE_ROUTE =
  `${APP_BASE}/user-profile-edit`;

export const DB_MY_ACTIVITY_ROUTE =
  `${APP_BASE}/me/activity`;

export const DB_ADMIN_TOOLS_ROUTE =
  `${APP_BASE}/admin-tools`;

export const DB_ADMIN_BASE_ROUTE =
  `${APP_BASE}/admin`;

// Cadence for the ipo-poll job is edited on the Scheduler page, not the IPO
// admin page — this constant backs that cross-link.
export const DB_ADMIN_SCHEDULER_ROUTE = `${DB_ADMIN_BASE_ROUTE}/scheduler`;

export const ADD_RECORD_ROUTE =
  `${DB_ADMIN_BASE_ROUTE}/records`;

export const EDIT_RECORD_ROUTE =
  `${DB_CINEMA_ROUTE}/edit-record/:title`;

export const DB_WALLET_ROUTE = `${APP_BASE}/db-wallet`;
export const DB_WALLET_SHARE_ROUTE = `${APP_BASE}/shared-doc/:token`;

export const DB_IPO_ROUTE = `${APP_BASE}/db-ipo`;
export const DB_IPO_DETAIL_ROUTE = `${DB_IPO_ROUTE}/:id`;
export const ipoDetailPath = (id) => `${DB_IPO_ROUTE}/${encodeURIComponent(id ?? '')}`;
// "My IPOs" — applicant-level saved-application list. Declared before DB_IPO_DETAIL_ROUTE's
// `:id` param in the route table (see App.jsx) so `/my` never gets swallowed as an :id.
export const DB_IPO_MY_ROUTE = `${APP_BASE}/db-ipo/my`;

/* =========================
 * USER ROLES
 * ========================= */
export const OWNER_USER_ROLE = "OWNER";
export const ADMIN_USER_ROLE = "ADMIN";
export const VIEWER_USER_ROLE = "VIEWER";

/* =========================
 * SIZE UNITS
 * ========================= */
export const KIB = "KiB";
export const MIB = "MiB";
export const GIB = "GIB";

/* =========================
 * MEDIA CONSTANTS
 * ========================= */
export const RECORD_TYPE_MOVIE = "movie";
export const RECORD_TYPE_SERIES = "series";

export const IMAGE_TYPE_POSTER = "poster";
export const IMAGE_TYPE_BACKDROP = "backdrop";

export const TMDB_IMAGE_BASE_URL =
  "https://image.tmdb.org/t/p/{quality}{imagePath}";

/* =========================
 * MUI LOADERS (REPLACEMENT)
 * ========================= */

/**
 * Full-page centered loader
 */
export const LOADER = (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "200px",
      width: "100%",
    }}
  >
    <CircularProgress color="error" size={40} />
  </Box>
);

/**
 * Button loader (same API as before)
 */
export const BUTTON_LOADER = (buttonColor = "primary", displayText = "Loading") => (
  <Button
    variant="contained"
    color={buttonColor}
    size="small"
    disabled
    startIcon={<CircularProgress size={16} color="inherit" />}
  >
    {displayText}...
  </Button>
);

/* =========================
 * DEFAULT EXPORT (BACKWARD SAFE)
 * ========================= */
export default {
  RE_LOGIN,

  ADD_RECORD_API,
  MIRROR_API,
  ADD_USER_API,
  ADD_PASSWORD_API,
  UPDATE_PASSWORD_API,
  DELETE_PASSWORD_API,
  DELETE_HOST_API,
  FIND_ALL_USERS_API,
  DELETE_USER_API,
  EDIT_USER_API,
  USER_ROLE_API,
  UPDATE_USER_ROLE_API,
  VALIDATE_TOKEN_API,

  DELETE_ICON_URL,
  VIEW_USER_ICON_URL,
  DB_WORLD_TEAL_SVG_ICON,

  DB_WORLD_HOME_ROUTE,
  LEGACY_PATH_PREFIX,
  DB_CINEMA_ROUTE,
  DB_CINEMA_BROWSE_ROUTE,
  DB_CINEMA_DOWNLOAD_PROGRESS_ROUTE,
  DB_CINEMA_MOVIES_ROUTE,
  DB_CINEMA_SERIES_ROUTE,
  DB_CINEMA_BROWSE_GENRE_ROUTE,
  DB_CINEMA_MOVIES_GENRE_ROUTE,
  DB_CINEMA_SERIES_GENRE_ROUTE,
  DB_MOVIE_DETIALS_ROUTE,
  DB_SERIES_DETIALS_ROUTE,
  DB_CINEMA_COLLECTION_ROUTE,
  DB_RECORD_MEDIA_FILES_ROUTE,
  DB_DOWNLOAD_QUEUE_ROUTE,
  DB_PLAYER_ROUTE,
  DB_PLAYER_ROUTE_PATTERN,
  playerPath,
  DB_PLAYER_DEMO_ROUTE,

  // Both were named exports only, so `Constants.RESET_PASSWORD_ROUTE` was undefined
  // everywhere it was read. App.jsx registered both routes with `path: undefined`,
  // and the "Forgot password?" handler called `navigate(undefined)`, which React
  // Router resolves to the CURRENT location — so the link fired and nothing moved.
  // That is the bug behind "I click forgot password and nothing happens"; the
  // handler itself was already correct. routes.test.js now asserts both resolve.
  RESET_PASSWORD_ROUTE,
  VERIFY_EMAIL_ROUTE,
  DB_ABOUT_ROUTE,
  DB_PRIVACY_ROUTE,
  DB_TERMS_ROUTE,
  DB_CONTACT_ROUTE,
  DB_WEATHER_ROUTE,
  DB_GAMES_ROUTE,
  DB_GAMES_TIC_TAC_TOE_ROUTE,
  DB_GAMES_SNAKE_ROUTE,
  DB_GAMES_MEMORY_MATCH_ROUTE,
  DB_GAMES_2048_ROUTE,
  DB_GAMES_MINESWEEPER_ROUTE,
  DB_GAMES_CONNECT_FOUR_ROUTE,

  DB_PASSWORD_MANAGER_ROUTE,
  DB_GENERATE_PASSWORD_ROUTE,
  DB_ADD_PASSWORD_ROUTE,
  DB_VIEW_PASSWORD_ROUTE,

  LOGIN_ROUTE,
  LOGOUT_ROUTE,
  REGISTRATION_ROUTE,

  USER_PROFILE_ROUTE,
  EDIT_USER_PROFILE_ROUTE,
  DB_MY_ACTIVITY_ROUTE,

  DB_ADMIN_TOOLS_ROUTE,
  DB_ADMIN_BASE_ROUTE,
  DB_ADMIN_SCHEDULER_ROUTE,
  ADD_RECORD_ROUTE,
  EDIT_RECORD_ROUTE,
  DB_WALLET_ROUTE,
  DB_WALLET_SHARE_ROUTE,
  DB_IPO_ROUTE,
  DB_IPO_DETAIL_ROUTE,
  ipoDetailPath,
  DB_IPO_MY_ROUTE,

  OWNER_USER_ROLE,
  ADMIN_USER_ROLE,
  VIEWER_USER_ROLE,

  KIB,
  MIB,
  GIB,

  RECORD_TYPE_MOVIE,
  RECORD_TYPE_SERIES,
  IMAGE_TYPE_POSTER,
  IMAGE_TYPE_BACKDROP,

  TMDB_IMAGE_BASE_URL,

  LOADER,
  BUTTON_LOADER,
};
