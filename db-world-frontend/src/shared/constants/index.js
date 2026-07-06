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
export const DB_WORLD_HOME_ROUTE = "/db-world";

export const DB_CINEMA_ROUTE = `${DB_WORLD_HOME_ROUTE}/db-cinema`;
export const DB_CINEMA_BROWSE_ROUTE = `${DB_CINEMA_ROUTE}/browse`;
export const DB_CINEMA_DOWNLOAD_PROGRESS_ROUTE =
  `${DB_CINEMA_ROUTE}/download-progress`;
export const DB_CINEMA_MOVIES_ROUTE = `${DB_CINEMA_ROUTE}/movie`;
export const DB_CINEMA_SERIES_ROUTE = `${DB_CINEMA_ROUTE}/tv-shows`;
export const DB_MOVIE_DETIALS_ROUTE = `${DB_CINEMA_ROUTE}/movie/:title`;
export const DB_SERIES_DETIALS_ROUTE = `${DB_CINEMA_ROUTE}/series/:title`;
export const DB_RECORD_MEDIA_FILES_ROUTE =
  `${DB_CINEMA_ROUTE}/record/:recordId/media-files`;
export const DB_DOWNLOAD_QUEUE_ROUTE = `${DB_CINEMA_ROUTE}/downloads`;
export const DB_PLAYER_ROUTE = `${DB_CINEMA_ROUTE}/player`;
// The player route carries the file id so URLs are unique + shareable + refreshable.
export const DB_PLAYER_ROUTE_PATTERN = `${DB_PLAYER_ROUTE}/:mediaFileId`;
export const playerPath = (mediaFileId) => `${DB_PLAYER_ROUTE}/${encodeURIComponent(mediaFileId ?? '')}`;

export const DB_WEATHER_ROUTE = `${DB_WORLD_HOME_ROUTE}/db-weather`;
export const DB_GAMES_ROUTE = `${DB_WORLD_HOME_ROUTE}/db-games`;
export const DB_GAMES_TIC_TAC_TOE_ROUTE = `${DB_GAMES_ROUTE}/tic-tac-toe`;
export const DB_GAMES_SNAKE_ROUTE = `${DB_GAMES_ROUTE}/snake`;
export const DB_GAMES_MEMORY_MATCH_ROUTE = `${DB_GAMES_ROUTE}/memory-match`;
export const DB_GAMES_2048_ROUTE = `${DB_GAMES_ROUTE}/2048`;

export const DB_PASSWORD_MANAGER_ROUTE =
  `${DB_WORLD_HOME_ROUTE}/db-password-manager`;
export const DB_GENERATE_PASSWORD_ROUTE =
  `${DB_PASSWORD_MANAGER_ROUTE}/generate-password`;
export const DB_ADD_PASSWORD_ROUTE =
  `${DB_PASSWORD_MANAGER_ROUTE}/add-password`;
export const DB_VIEW_PASSWORD_ROUTE =
  `${DB_PASSWORD_MANAGER_ROUTE}/view-password`;

export const LOGIN_ROUTE = `${DB_WORLD_HOME_ROUTE}/login`;
export const LOGOUT_ROUTE = `${DB_WORLD_HOME_ROUTE}/logout`;
export const REGISTRATION_ROUTE = `${DB_WORLD_HOME_ROUTE}/registration`;

export const USER_PROFILE_ROUTE =
  `${DB_WORLD_HOME_ROUTE}/user-profile`;
export const EDIT_USER_PROFILE_ROUTE =
  `${DB_WORLD_HOME_ROUTE}/user-profile-edit`;

export const DB_MY_ACTIVITY_ROUTE =
  `${DB_WORLD_HOME_ROUTE}/me/activity`;

export const DB_ADMIN_TOOLS_ROUTE =
  `${DB_WORLD_HOME_ROUTE}/admin-tools`;

export const DB_ADMIN_BASE_ROUTE =
  `${DB_WORLD_HOME_ROUTE}/admin`;

export const ADD_RECORD_ROUTE =
  `${DB_ADMIN_BASE_ROUTE}/records`;

export const EDIT_RECORD_ROUTE =
  `${DB_CINEMA_ROUTE}/edit-record/:title`;

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
  DB_CINEMA_ROUTE,
  DB_CINEMA_BROWSE_ROUTE,
  DB_CINEMA_DOWNLOAD_PROGRESS_ROUTE,
  DB_CINEMA_MOVIES_ROUTE,
  DB_CINEMA_SERIES_ROUTE,
  DB_MOVIE_DETIALS_ROUTE,
  DB_SERIES_DETIALS_ROUTE,
  DB_RECORD_MEDIA_FILES_ROUTE,
  DB_DOWNLOAD_QUEUE_ROUTE,
  DB_PLAYER_ROUTE,
  DB_PLAYER_ROUTE_PATTERN,
  playerPath,

  DB_WEATHER_ROUTE,
  DB_GAMES_ROUTE,
  DB_GAMES_TIC_TAC_TOE_ROUTE,
  DB_GAMES_SNAKE_ROUTE,
  DB_GAMES_MEMORY_MATCH_ROUTE,
  DB_GAMES_2048_ROUTE,

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
  ADD_RECORD_ROUTE,
  EDIT_RECORD_ROUTE,

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
