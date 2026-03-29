# DB World Frontend — Architecture Reference

> **Stack:** React 18 · Vite 5 · Redux · Zustand · MUI v7 · React Router v6 · Capacitor 7
> **Pattern:** Feature-Sliced / Bulletproof React

---

## Directory Tree

```
db-world-frontend/
├── index.html                          # Vite entry HTML (root level, not public/)
├── vite.config.js                      # Vite config: aliases, proxy, chunking
├── jsconfig.json                       # IDE path alias support
├── package.json                        # Dependencies & npm scripts
├── capacitor.config.json               # Capacitor (Android) config
│
└── src/
    ├── main.jsx                        # App entry point — mounts Redux, MUI, Router
    │
    ├── app/                            # App-wide setup
    │   ├── App.jsx                     # Root component: theme, routes, error boundary
    │   ├── store.js                    # Redux store creation
    │   ├── redux/
    │   │   ├── action/
    │   │   │   └── allActions.js       # All Redux action creators
    │   │   └── reducer/
    │   │       ├── rootReducers.js     # combineReducers root
    │   │       ├── loginReducer.js
    │   │       ├── userReducer.js
    │   │       ├── searchReducer.js
    │   │       ├── reloadMoviesReducer.js
    │   │       ├── moviePageNumberReducer.js
    │   │       ├── seriesPageNumberReducer.js
    │   │       ├── filerSelectionReducer.js
    │   │       └── downloadProgressReducer.js
    │   └── store/                      # Zustand stores
    │       ├── recordStore.js          # Current cinema record state
    │       └── useImageCardStore.js    # Image card hover state
    │
    ├── features/                       # Domain features (self-contained)
    │   │
    │   ├── auth/                       # Authentication feature
    │   │   ├── Login.js
    │   │   ├── LogOut.js
    │   │   ├── PrivateRoute.js         # Role-based route guard
    │   │   └── context/
    │   │       └── Authentication.js   # AuthContext + useAuth hook
    │   │
    │   ├── cinema/                     # DB Cinema — Netflix-style streaming catalog
    │   │   │
    │   │   ├── api/
    │   │   │   └── cinemaApi.js        # ★ All cinema REST calls (rails, catalog, interactions)
    │   │   │                           #   + tmdbImg(path, quality) helper
    │   │   ├── hooks/
    │   │   │   ├── useRailRecords.js   # ★ Lazy-load paginated rail records (intersection observer)
    │   │   │   ├── useInteractions.js  # ★ Batch interaction fetch + optimistic toggle
    │   │   │   └── useSearch.js        # ★ Debounced autocomplete + full search
    │   │   │
    │   │   ├── components/
    │   │   │   ├── HeroBanner/
    │   │   │   │   └── HeroBanner.jsx  # ★ Full-viewport hero: backdrop, auto-cycle, Play/Info/MyList
    │   │   │   ├── RailRow/
    │   │   │   │   └── RailRow.jsx     # ★ Horizontal rail with lazy load + left/right scroll arrows
    │   │   │   ├── RecordCard/
    │   │   │   │   └── RecordCard.jsx  # ★ Netflix card: poster → hover expand w/ backdrop + actions
    │   │   │   ├── CinemaTiles.js      # Legacy tile config (kept for reference)
    │   │   │   ├── LazyImage.js        # Lazy-loaded image with skeleton fallback
    │   │   │   ├── Footer/Footer.js
    │   │   │   └── record-detailes/    # Detail-page section components
    │   │   │       ├── BackdropSection.jsx
    │   │   │       ├── CustomComponents.jsx
    │   │   │       ├── GenresList.jsx
    │   │   │       ├── MediaCarousel.jsx
    │   │   │       ├── MediaSection.jsx
    │   │   │       ├── PeopleGridSection.js
    │   │   │       ├── ProductionDetails.jsx
    │   │   │       ├── RatingReviewSection.jsx
    │   │   │       ├── StreamingProviders.jsx
    │   │   │       └── VideoTrailers.jsx
    │   │   │
    │   │   ├── cover/                  # Legacy hero carousel (superseded by HeroBanner)
    │   │   │   ├── index.js
    │   │   │   └── CoverSkeleton.js
    │   │   ├── icons/                  # Standalone action-icon components
    │   │   │   ├── copy.js
    │   │   │   ├── download.js
    │   │   │   ├── play.js
    │   │   │   ├── reaction.js
    │   │   │   ├── watched.js
    │   │   │   ├── watchlist.js
    │   │   │   └── IconButtonStyles.jsx
    │   │   ├── navbar/
    │   │   │   ├── index.js            # Sticky cinema navbar (uses fetchPageCategories)
    │   │   │   ├── CategoryContext.js  # Genre/category React Context
    │   │   │   └── CategoryModal.js
    │   │   │
    │   │   ├── screens/
    │   │   │   ├── CinemaPage/
    │   │   │   │   └── CinemaPage.jsx  # ★ REWRITTEN: hero + genre filter + lazy RailRows
    │   │   │   │                       #   Props: pageType = 'home'|'movies'|'series'
    │   │   │   ├── movie-details/
    │   │   │   │   └── index.js        # Movie detail (uses fetchRecord from cinemaApi)
    │   │   │   ├── series-details/
    │   │   │   │   ├── SeriesDetailsPage.js  # Series detail (uses fetchRecord from cinemaApi)
    │   │   │   │   ├── SeasonTabs.jsx
    │   │   │   │   └── SeriesDetailsPage.module.css
    │   │   │   ├── download/
    │   │   │   │   ├── index.js        # Media file download/stream viewer
    │   │   │   │   ├── VideoModal.jsx
    │   │   │   │   ├── VideoModal.css
    │   │   │   │   └── VideoPlayer.js
    │   │   │   ├── GenreView/
    │   │   │   │   ├── index.js
    │   │   │   │   └── MediaCard.js
    │   │   │   ├── MediaFileInfo/
    │   │   │   │   ├── MediaInfoContent.jsx
    │   │   │   │   ├── MediaInfoRender.jsx
    │   │   │   │   ├── PlayerSelectionDialog.js
    │   │   │   │   ├── PlayerService.js
    │   │   │   │   └── HLS/
    │   │   │   │       ├── HLSVideoPlayer.js
    │   │   │   │       └── HLSPlayerOptions.js
    │   │   │   └── search/
    │   │   │       ├── index.js
    │   │   │       └── FileDetailsModal.js
    │   │   │
    │   │   ├── services/               # Legacy endpoint configs (superseded by cinemaApi.js)
    │   │   │   ├── axios.js
    │   │   │   ├── cinemaConfig.js
    │   │   │   └── requests.js
    │   │   ├── tilesRow/               # Legacy tile row (superseded by RailRow)
    │   │   │   ├── index.js / ImageCard.js / ImageCardItem.js
    │   │   │   └── RecordPreviewModal.js / ModalProtal.js / ScrollControls.js
    │   │   └── utils/hooks/
    │   │       └── useWindowSize.js
    │   │
    │   ├── admin/                      # Admin Tools feature
    │   │   ├── AdminPage/
    │   │   │   ├── AdminPage.js        # Tabbed admin dashboard (lazy-loaded)
    │   │   │   ├── GridView.js
    │   │   │   ├── TabView.js
    │   │   │   └── ViewSelector.js
    │   │   ├── DownloadManager/        # Aria2 / Mirror download manager
    │   │   │   ├── index.js
    │   │   │   ├── DownloadsList.js
    │   │   │   ├── DownloadTypeSelector.js
    │   │   │   ├── Header.js
    │   │   │   ├── Status.js
    │   │   │   ├── StatusCard.js
    │   │   │   ├── Mirror/
    │   │   │   │   ├── HttpFile.js
    │   │   │   │   ├── LinksManager.js
    │   │   │   │   ├── ProcessingOptions.js
    │   │   │   │   ├── QuickActions.js
    │   │   │   │   └── SecurityOptions.js
    │   │   │   └── YoutubeDownloader/
    │   │   │       ├── YoutubeDownloader.js
    │   │   │       └── FormatSelection.js
    │   │   ├── FileExplorer/           # Flmngr file manager integration
    │   │   │   ├── FlmngrStandalone.js
    │   │   │   ├── FlmngrManager.js
    │   │   │   ├── FileExplorer.js
    │   │   │   ├── DestinationPicker.js
    │   │   │   ├── FileInfoModal.js
    │   │   │   ├── FileActionModal.js
    │   │   │   ├── FileMenus.js
    │   │   │   ├── useFileOperations.js
    │   │   │   ├── useDynamicCSS.js
    │   │   │   ├── useFlmngrTheme.js
    │   │   │   └── FlmngrManager.module.css
    │   │   ├── LogDashboard/
    │   │   │   ├── LogDashboard.jsx
    │   │   │   ├── LogViewer.js
    │   │   │   ├── JsonLogViewer.js
    │   │   │   └── ChartsWrapper.js
    │   │   ├── MediaFilesManagement/
    │   │   │   ├── MediaFilesManagement.js
    │   │   │   ├── MediaGridView.js
    │   │   │   ├── MediaTableView.js
    │   │   │   ├── MediaSearchFilters.js
    │   │   │   └── MediaSystemActions.js
    │   │   ├── RecordsManagment/       # TMDB record CRUD
    │   │   │   ├── index.js
    │   │   │   ├── AddRecordModal.js
    │   │   │   ├── RecordsTableView.js
    │   │   │   ├── RecordsCardView.js
    │   │   │   ├── RecordMediaFilesModal.js
    │   │   │   ├── TMDBUpdateStatusModal.js
    │   │   │   ├── DeleteConfirmationDialog.js
    │   │   │   ├── CleanMediaFileInfoButton.js
    │   │   │   ├── SwitchWithLoader.js
    │   │   │   └── useInfiniteScroll.jsx
    │   │   ├── ServerInfo/             # System monitoring dashboard
    │   │   │   ├── ServerInfo.js
    │   │   │   ├── Dashboard.js
    │   │   │   ├── WindowsServerInfoDashboard.js
    │   │   │   └── RaspberryPiServerInfoDashboard.js
    │   │   ├── ActivityLogs/
    │   │   │   ├── ActivityLogs.js
    │   │   │   ├── ActivityLogsList.js
    │   │   │   ├── ActivityFilters.js
    │   │   │   ├── activityLogsService.js
    │   │   │   └── useInfiniteScroll.js
    │   │   ├── UserCinemaActivity/
    │   │   │   └── index.js
    │   │   ├── UserManagment/
    │   │   │   ├── index.js
    │   │   │   ├── UsersTableView.js
    │   │   │   ├── UsersCardView.js
    │   │   │   ├── MobileUserCard.js
    │   │   │   ├── UserEditModal.js
    │   │   │   └── UserViewModal.js
    │   │   ├── RedisManager.js
    │   │   └── SystemInfo.js
    │   │
    │   ├── users/                      # User profile feature
    │   │   ├── Profile.js
    │   │   ├── EditProfile.js
    │   │   └── registration.js
    │   │
    │   ├── password-manager/           # DB Password Manager feature
    │   │   ├── PasswordManagement.js
    │   │   ├── AddPassword.js
    │   │   ├── GeneratePassword.js
    │   │   └── ViewPassword.js
    │   │
    │   ├── weather/                    # DB Weather feature
    │   │   ├── weather.js
    │   │   └── Map.js
    │   │
    │   └── games/                     # DB Games feature
    │       └── TicTacToe.js
    │
    ├── shared/                         # Cross-feature shared code
    │   ├── constants/
    │   │   └── index.js                # Routes, roles, API base paths, config
    │   ├── services/
    │   │   ├── ApiServices.js          # All REST API call functions (~600 lines)
    │   │   └── CommonServices.js       # Shared hooks & helpers (Redux dispatch)
    │   └── components/
    │       ├── layout/
    │       │   ├── Header.js           # Top navigation bar
    │       │   ├── Footer.js           # App footer
    │       │   ├── Home.js             # Landing page
    │       │   └── ErrorPage.js        # 404 page
    │       └── ui/
    │           ├── Toast.js            # Global toast notification system
    │           ├── LoadingSpinner.js
    │           ├── LoadingSpinner.css
    │           └── utils/
    │               ├── AxiosInstants.js    # Axios instance with auth interceptor
    │               ├── errorHandler.js     # Global error toast handler
    │               ├── successHandler.js   # Global success toast handler
    │               └── useWebSocket.js     # Generic WebSocket hook
    │
    ├── platform/
    │   └── android/                    # Capacitor Android integrations
    │       ├── BackButtonHandler.js    # Native back-button routing
    │       ├── AndroidPlugins.js       # Capacitor plugin wrappers
    │       └── MyDownloadManagerWeb.js
    │
    ├── assets/
    │   └── images/                     # Static image assets
    │       ├── db_world_teal.svg
    │       ├── login.png / login_new.png
    │       ├── backGround.jpg / backImage.jpg
    │       ├── spinner.gif / loading.gif
    │       └── ... (11 assets total)
    │
    └── styles/
        └── global.css                  # Global CSS (body, scrollbar, keyframes)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / Capacitor                      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      React App Tree                       │   │
│  │                                                           │   │
│  │  main.jsx                                                 │   │
│  │    └── <Provider store>          ← Redux                  │   │
│  │         └── <LocalizationProvider>  ← MUI DatePickers     │   │
│  │              └── <ConfirmProvider>  ← material-ui-confirm │   │
│  │                   └── <ToastProvider>                     │   │
│  │                        └── App.jsx                        │   │
│  │                             ├── <ThemeProvider>  (MUI)    │   │
│  │                             ├── <AuthProvider>            │   │
│  │                             ├── <CategoryProvider>        │   │
│  │                             └── <Router>                  │   │
│  │                                  ├── Public Routes        │   │
│  │                                  ├── Protected Routes     │   │
│  │                                  │    └── <PrivateRoute>  │   │
│  │                                  └── Admin Routes         │   │
│  │                                       └── <PrivateRoute>  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Management

```
┌──────────────────────────────────────────────────────────────────┐
│                         State Layers                              │
│                                                                   │
│  ┌─────────────── Redux Store (Global) ────────────────────┐    │
│  │  loginReducer       → isLoggedIn (bool)                  │    │
│  │  userReducer        → currentUser object                 │    │
│  │  searchReducer      → search query string                │    │
│  │  reloadMoviesReducer → trigger flag for cinema refresh   │    │
│  │  moviePageNumberReducer  → pagination per genre/section  │    │
│  │  seriesPageNumberReducer → pagination per genre/section  │    │
│  │  filerSelectionReducer   → active filter state           │    │
│  │  downloadProgressReducer → mirror download progress      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────── Zustand Stores (Local) ─────────────────┐    │
│  │  recordStore       → selected cinema record (preview)    │    │
│  │  useImageCardStore → hovered image card state            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────── React Context ──────────────────────────┐    │
│  │  AuthContext (Authentication.js)                          │    │
│  │    → user, token, login(), logout(), isAuthenticated()   │    │
│  │  CategoryContext (cinema/navbar/CategoryContext.js)       │    │
│  │    → selected genre/category for cinema nav              │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Route Map

```
/                       → redirect to /home
/home                   → Home (public)
/login                  → Login (public)
/register               → Registration (public)
/weather                → Weather (public)
/games                  → TicTacToe (public)
/password-manager       → PasswordManagement (public)

── Protected (VIEWER / ADMIN / OWNER) ──────────────────────────
/cinema                 → redirect to /cinema/browse
/cinema/browse          → CinemaPage [BROWSE tiles]
/cinema/movies          → CinemaPage [MOVIES tiles]
/cinema/series          → CinemaPage [SERIES tiles]
/cinema/download/:id    → MediaDownloadViewer (lazy)
/cinema/movie/:id       → MovieDetailsPage (lazy)
/cinema/series/:id      → SeriesDetailsPage (lazy)
/password/add           → AddPassword
/password/generate      → GeneratePassword
/password/view/:id      → ViewPassword
/profile                → Profile
/profile/edit           → EditProfile
/logout                 → LogOut

── Admin (ADMIN / OWNER) ───────────────────────────────────────
/admin                  → AdminPage (lazy)
/file-manager           → FlmngrStandalone
```

---

## API & Network Layer

```
  Component / Hook
       │
       ▼
  shared/services/ApiServices.js          ← ~600 lines, all REST calls
       │   imports
       ├── shared/components/ui/utils/AxiosInstants.js
       │       └── axios instance with JWT Authorization header
       ├── shared/components/ui/utils/errorHandler.js
       │       └── toast on error response
       └── shared/services/CommonServices.js
               └── Redux dispatch helpers

  shared/components/ui/utils/useWebSocket.js   ← generic WS hook
       └── used by: DownloadManager (mirror status)

  features/cinema/services/axios.js            ← cinema-scoped axios (legacy)
       └── features/cinema/services/requests.js  (legacy)

  features/cinema/api/cinemaApi.js             ← NEW cinema API layer
       ├── fetchPageRails(page, category)       → GET /api/cinema/{page}
       ├── fetchPageCategories(page)            → GET /api/cinema/{page}/categories
       ├── fetchRailPage(railId, page, size)    → GET /api/cinema/rails/{id}/records
       ├── fetchRecord(id)                      → GET /api/cinema/catalog/{id}
       ├── searchRecords(q, page)               → GET /api/cinema/catalog/search
       ├── autocomplete(q)                      → GET /api/cinema/catalog/autocomplete
       └── addWatchlist / toggleLike / etc.     → POST|DELETE /api/cinema/interactions/*
```

---

## Feature Dependency Map

```
  features/auth          ←── shared/constants
       ↓                 ←── shared/services/ApiServices
  features/cinema        ←── cinema/api/cinemaApi (self-contained API layer)
       ↓                 ←── shared/constants (routes)
       ↓                 ←── app/redux (userId for interactions)
  features/admin         ←── shared/services/CommonServices
       ↓                 ←── app/redux (actions)
  features/users         ←── shared/services/ApiServices
  features/password-mgr  ←── shared/constants
  features/weather       ←── shared/services/ApiServices
  features/games         (standalone)

  platform/android       ←── features/cinema/icons/play.js
                         ←── features/cinema/screens/MediaFileInfo/HLS/

  shared/components/ui   ←── shared/constants
                         ←── shared/services/CommonServices

  app/App.jsx            ←── ALL features (route-level imports)
```

---

## Build & Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Dev server on :3000 (uses .env from shell) |
| `dev:local` | `env-cmd -f ../runtime/.env.local vite` | Local env |
| `dev:production` | `env-cmd -f ../runtime/.env.production vite` | Prod env in dev mode |
| `build` | `vite build` | Production build → `build/` |
| `build:local` | `env-cmd -f ../runtime/.env.local vite build` | Local prod build |
| `build:production` | `env-cmd -f ../runtime/.env.production vite build` | Prod build |
| `preview` | `vite preview` | Preview production build |
| `test` | `vitest` | Unit tests |
| `cap:sync` | `npx cap sync` | Sync to Capacitor Android |

### Vite Chunk Strategy

```
vendor  → react, react-dom, react-router-dom
mui     → @mui/material, @mui/icons-material, @emotion/react, @emotion/styled
charts  → recharts, chart.js, react-chartjs-2
grid    → ag-grid-react, @mui/x-data-grid
player  → hls.js, react-player
```

---

## Path Aliases

| Alias | Resolves to | Usage |
|-------|------------|-------|
| `@app` | `src/app/` | Redux store, reducers, App entry |
| `@features` | `src/features/` | Domain feature modules |
| `@shared` | `src/shared/` | Constants, services, shared UI |
| `@assets` | `src/assets/` | Images, static files |
| `@platform` | `src/platform/` | Capacitor / Android integrations |
| `@styles` | `src/styles/` | Global CSS |

---

## Mobile (Capacitor)

```
capacitor.config.json
    appId:    com.dbworld.app
    webDir:   build

platform/android/
    BackButtonHandler.js      → intercepts Android back button → react-router navigate(-1)
    AndroidPlugins.js         → wraps @capacitor/* plugins (FileSystem, Browser, etc.)
    MyDownloadManagerWeb.js   → web fallback for download manager
```

---

## Cinema UI — Netflix-Style Architecture (v2, 2026-03-26)

### Data Flow

```
Route /cinema/browse|movies|series
  │
  └── CinemaPage.jsx (pageType prop)
        │
        ├── fetchPageRails(apiPage)       → List<RailDto> (titles + IDs, no records)
        ├── fetchPageCategories(apiPage)  → List<GenreDto>  (genre filter pills)
        │
        ├── HeroBanner                   ← first rail, eagerly loaded via useRailRecords
        │     ├── backdrop images from RailRecordDto.backdropPath
        │     ├── auto-cycles every 8 s with framer-motion AnimatePresence
        │     └── Play / More Info / My List buttons → interactions via useInteractions
        │
        ├── GenreBar                     ← Chip pills, sets ?category= filter
        │
        └── RailRow × N                  ← one per RailDto from backend
              ├── Intersection Observer  → trigger() when row enters viewport
              ├── useRailRecords(railId) → fetchRailPage() on demand
              ├── left/right scroll arrows with loadMore() at right end
              └── RecordCard × M
                    ├── poster (2:3) normally
                    ├── hover: scale 1.12×, backdrop overlay, title/genres/rating
                    └── action buttons: Play · MyList · Like · Info
```

### Backend API Mapping

| UI Component | Backend Endpoint |
|---|---|
| CinemaPage (rails metadata) | `GET /api/cinema/{home\|movies\|series}?category=` |
| CinemaPage (genre pills) | `GET /api/cinema/{page}/categories` |
| RailRow (lazy record load) | `GET /api/cinema/rails/{railId}/records?page=&size=` |
| MovieDetailsPage / SeriesDetailsPage | `GET /api/cinema/catalog/{id}` |
| Navbar search autocomplete | `GET /api/cinema/catalog/autocomplete?q=` |
| Full search results | `GET /api/cinema/catalog/search?q=&page=` |
| Watchlist / Like / Watched toggles | `POST\|DELETE /api/cinema/interactions/{type}?userId=&recordId=` |
| Batch interaction load | `POST /api/cinema/interactions/batch?userId=` |

### RailDto Structure (from backend)

```
RailDto {
  id:             Long         - used as key + passed to fetchRailPage()
  title:          String       - row heading
  priority:       Integer      - page ordering (lower = higher)
  active:         Boolean      - show/hide
  limitSize:      Integer      - page size for fetchRailPage (default 20)
  infiniteScroll: boolean      - whether RailRow loads more on right-scroll
  pageType:       HOME|MOVIES|SERIES
}

RailRecordDto {                 - returned by fetchRailPage()
  id, title, type (MOVIE|TV_SERIES)
  posterPath, posterPathClean   - TMDB poster paths (prepend https://image.tmdb.org/t/p/w342)
  backdropPath, backdropPathText - TMDB backdrop paths (prepend .../original)
  voteAverage, popularity, releaseDate, overview
  genres: String[]
  previewVideoUrl               - trailer URL
  providers: TmdbProviderDto[]
}
```

### Key Hooks

| Hook | Purpose |
|---|---|
| `useRailRecords(railId, size, infinite, category)` | Paginates one rail; exposes `trigger()` + `loadMore()` |
| `useInteractions()` | Batch-loads + optimistically toggles watchlist/like/watched |
| `useSearch()` | Debounced autocomplete (300ms) + on-demand full search |

---

*Updated: 2026-03-26*
