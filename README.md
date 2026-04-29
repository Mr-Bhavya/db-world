# DB World

A full-stack web and Android application — cinema streaming, password manager, weather, games, and an admin console.

**Live:** [https://db-world.in](https://db-world.in)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
│   React 18 + Vite  ·  MUI v7  ·  Capacitor (Android)│
└───────────────────────┬─────────────────────────────┘
                        │ REST / WebSocket
┌───────────────────────▼─────────────────────────────┐
│                   Spring Boot 3.5                    │
│   JWT (RSA)  ·  JPA/Hibernate  ·  WebFlux WebClient │
└──────────┬────────────────────────┬─────────────────┘
           │                        │
    ┌──────▼──────┐          ┌──────▼──────┐
    │    MySQL    │          │    Redis     │
    │  (primary)  │          │   (cache)    │
    └─────────────┘          └─────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, MUI v7, TanStack Query, Zustand, Framer Motion |
| Mobile | Capacitor 7 (Android) |
| Backend | Spring Boot 3.5, Java 21, Hibernate 6, WebFlux |
| Auth | JWT (RSA keypair), refresh-token cookie |
| Database | MySQL 8, Redis |
| External APIs | TMDB (cinema metadata), Aria2 (downloads) |
| CI/CD | Jenkins (parallel build/deploy), Nginx |

---

## Repository Structure

```
db-world/
├── db-world-backend/       # Spring Boot WAR — REST APIs and services
├── db-world-frontend/      # React SPA — served from Spring Boot in prod
├── docs/                   # Architecture and planning docs
├── postman/                # Postman collections
├── runtime/                # Runtime env files (gitignored)
├── nginx-dbworld.conf      # Nginx reverse-proxy config
├── Jenkinsfile             # CI/CD pipeline (parallel build + deploy)
└── switch-env.ps1          # Developer utility — switch local env profiles
```

---

## Quick Start

See the module-level READMEs for full setup instructions:

- [Backend →](db-world-backend/README.md) — Spring Boot, MySQL, Redis, local config
- [Frontend →](db-world-frontend/README.md) — Node, Vite dev server, Capacitor

---

## CI/CD

The `Jenkinsfile` at the repo root defines the production pipeline:

1. **Checkout** — shallow clone of the selected branch
2. **Build** — frontend (`npm ci` + Vite) and backend (Maven) run in parallel
3. **Deploy** — frontend symlink swap + backend `dbworldctl update` run in parallel

Trigger a build in Jenkins and select the branch, build type (`full` / `frontend` / `backend`), and whether to skip tests or deployment.

---

## Features

| Feature | Description |
|---|---|
| Cinema | Browse and stream movies/series with TMDB metadata |
| Password Manager | Encrypted credential storage |
| Weather | Location-based weather |
| Games | Built-in browser games |
| Admin Console | User management, TMDB sync, ingestion pipeline, log viewer |
