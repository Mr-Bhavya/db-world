# DB World

A full-stack web + Android application — cinema streaming, password manager, weather,
games, and an admin console.

**Live:** [https://db-world.in](https://db-world.in) · **API:** [https://api.db-world.in](https://api.db-world.in) · **Version:** `3.0.0`

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Client Layer                      │
│  React 18 + Vite 6  ·  MUI v7  ·  Capacitor 7 (Android)│
└───────────────────────┬──────────────────────────────┘
                        │ REST / WebSocket
┌───────────────────────▼──────────────────────────────┐
│           Spring Boot 4  ·  Java 25  (Jetty)          │
│   Spring Security + JWT (RSA)  ·  JPA/Hibernate       │
│   WebFlux WebClient  ·  WebSocket                     │
└──────────┬─────────────────────────┬──────────────────┘
           │                         │
    ┌──────▼──────┐           ┌──────▼──────┐
    │   MySQL 8   │           │    Redis     │
    │  (primary)  │           │   (cache)    │
    └─────────────┘           └──────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite 6 · MUI v7 · TanStack Query 5 · Zustand 5 · Framer Motion 12 · React Router 6 |
| Mobile | Capacitor 7 (Android) — sideloaded, self-updating APK |
| Backend | Spring Boot 4.0 · Java 25 · Jetty · JPA/Hibernate · WebFlux · WebSocket |
| Auth | Spring Security · JWT (RSA keypair) + refresh-token cookie · biometric unlock |
| Data | MySQL 8 · Redis (cache) |
| Tooling | springdoc-openapi (Swagger UI) · Jasypt (encrypted properties) · MapStruct · Lombok |
| External | TMDB (cinema metadata) · aria2c (downloads) |
| CI/CD | GitHub Actions (CI · release · deploy) · Nginx |

---

## Repository Structure

```
db-world/
├── .github/workflows/   # GitHub Actions — CI, app release, backend WAR, deploy
├── db-world-backend/    # Spring Boot 4 WAR — REST APIs + services (Java 25)
├── db-world-frontend/   # React 18 SPA + Capacitor Android app
├── docs/                # Architecture, planning, and RELEASING.md (release runbook)
├── postman/             # Postman collections
├── scripts/             # Developer utilities (e.g. publish-android.ps1)
├── runtime/             # Runtime env files (gitignored)
└── switch-env.ps1       # Switch local env profiles
```

Server infrastructure — Nginx, systemd units, `dbworldctl`, and the legacy Jenkins
pipeline — lives in the separate **`db-world-config`** repo.

---

## Quick Start

See the module-level READMEs for full setup:

- [Backend →](db-world-backend/README.md) — Spring Boot, MySQL, Redis, local config (JDK 25)
- [Frontend →](db-world-frontend/README.md) — Node, Vite dev server, Capacitor

---

## CI/CD

Automated with **GitHub Actions** ([`.github/workflows/`](.github/workflows/)) — full
runbook in [`docs/RELEASING.md`](docs/RELEASING.md). Backend and app release on
independent tracks (a backend change never rebuilds the APK, and vice-versa):

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PRs into `development`/`main` | Lint frontend + compile backend |
| `release.yml` | tag `vX.Y.Z` | Build frontend bundle + **signed APK** + `version.json` → GitHub Release |
| `backend.yml` | push to `main` under `db-world-backend/**` | Build the backend **WAR** → rolling `backend-latest` prerelease |
| `deploy.yml` | manual | Self-hosted runner on the server pulls the artifacts and deploys |

The Android app self-updates: it reads `/api/app/version` (which proxies the latest
GitHub Release's `version.json`) and installs the newer signed APK.

---

## Features

| Feature | Description |
|---|---|
| Cinema | Browse + stream movies/series (TMDB metadata), continue-watching, downloads, watchlist; Netflix-style UI on web + Android |
| Password Manager | Encrypted credential storage |
| Weather | Location-based weather |
| Games | Built-in browser games |
| Admin Console | User management, TMDB sync, media ingestion pipeline, log viewer, scheduler |
