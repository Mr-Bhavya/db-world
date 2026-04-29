# DB World — Frontend

React 18 SPA built with Vite. Served as static files from Spring Boot in production; runs against the backend API via a dev-server proxy in development.

---

## Tech Stack

| Library | Purpose |
|---|---|
| React 18 + Vite 5 | UI framework and build tool |
| MUI v7 + Emotion | Component library and styling |
| TanStack Query v5 | Server state, caching, pagination |
| React Hook Form + Zod | Forms and validation |
| Zustand | Client-side global state |
| Framer Motion | Animations |
| Notistack | Toast notifications |
| Capacitor 7 | Android app wrapper |
| Axios | HTTP client |
| Recharts + Chart.js | Charts and data visualisation |

---

## Prerequisites

- Node.js 20+
- npm 10+
- Backend running on `http://localhost:8080` (or set `VITE_API_BASE_URL`)

---

## Setup

```bash
cd db-world-frontend
npm install
```

### Environment files

The app reads env files from `../runtime/` (one level above `db-world-frontend`):

```
runtime/
├── .env.local        # local development
└── .env.production   # production build (lives at /etc/dbworld/ on the server)
```

Minimum required variable:

```env
VITE_API_BASE_URL=http://localhost:8080
```

---

## Development

```bash
# Vite dev server — proxies /api/* to VITE_API_BASE_URL
npm run dev

# With explicit local env file
npm run dev:local
```

The dev server binds to `0.0.0.0:3000` and is reachable from other devices on the same network, which is useful for testing on a physical Android device.

Mock middleware is active in dev mode for:
- `GET /api/stream/media-info/:recordId`
- `GET /api/cinema/catalog/searches`
- `GET /api/stream/search`

---

## Build

```bash
# Production build (reads ../runtime/.env.production)
npm run build:production

# Local build (reads ../runtime/.env.local)
npm run build:local

# Output: dist/
```

The `dist/` folder is copied into `src/main/resources/public/` inside the backend WAR so the whole application ships as a single deployable artifact.

---

## Project Structure

```
src/
├── app/              # App shell, routing, global layout
├── features/
│   ├── adminv2/      # Admin console (User Mgmt, TMDB Sync, Ingestion, Logs)
│   ├── auth/         # Login, registration, profile, login history
│   ├── cinema/       # Browse, record detail, streaming player
│   ├── games/        # Browser games
│   ├── password-manager/
│   ├── users/        # User settings
│   └── weather/
├── shared/           # Shared hooks, components, utilities
├── platform/         # Capacitor / Android bridge code
├── assets/           # Static images and fonts
└── styles/           # Global CSS, theme tokens, AMOLED/light theme
```

---

## Android (Capacitor)

```bash
# After a production build, sync assets to the Android project
npm run cap:sync

# Then open the android/ directory in Android Studio and run on device
```

Capacitor plugins in use: `@capacitor/app`, `@capacitor/filesystem`, `@capacitor/geolocation`, `@capacitor/haptics`, `@capacitor/push-notifications`, `@capacitor/status-bar`, `@capacitor/screen-orientation`, `capacitor-video-player`.

---

## Linting and Tests

```bash
npm run lint    # ESLint
npm run test    # Vitest
```
