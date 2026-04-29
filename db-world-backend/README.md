# DB World — Backend

Spring Boot 3.5 REST API server. Packages as a WAR and runs on the production server via `dbworldctl`. Also serves the frontend SPA from `classpath:/public/` in the same WAR.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Spring Boot 3.5 / Java 21 | Application framework |
| Spring Security + JWT (RSA) | Authentication and authorisation |
| Spring Data JPA + Hibernate 6 | ORM and database access |
| MySQL 8 | Primary datastore |
| Redis | Response caching (60 s default TTL) |
| Spring WebFlux / WebClient | Reactive HTTP client (TMDB API) |
| Spring WebSocket | Real-time push to admin console |
| Jasypt | Encrypted properties |
| MapStruct 1.6 | DTO ↔ entity mapping |
| Log4j2 + LMAX Disruptor | Async structured logging |
| SpringDoc OpenAPI 2.6 | Auto-generated Swagger UI |

---

## Prerequisites

- Java 21+
- Maven 3.9+ (or use the wrapper at `mvnw`)
- MySQL 8 running and accessible
- Redis running locally (`localhost:6379` by default)

---

## Local Development

### 1. Configure the local profile

Copy the example and fill in your values:

```bash
cp src/main/resources/application-prod_laptop.yml.example \
   src/main/resources/application-local.yml
```

Key properties to set:

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/dbworld
    username: <user>
    password: ENC(<jasypt-encrypted-value>)   # or plain text for local dev

dbworld:
  jwt:
    private-key-path: /path/to/rsa-private.pem
    public-key-path:  /path/to/rsa-public.pem
  stream:
    path: /path/to/media/files
```

### 2. Build and run

```bash
# Compile only (skips tests, fast feedback)
mvn compile -P local

# Run with the local profile
mvn spring-boot:run -P local

# Or run the packaged JAR directly
mvn package -P local -DskipTests
java -jar target/db-world.war
```

The server starts on **port 8080** by default. Swagger UI is available at:
`http://localhost:8080/swagger-ui/index.html`

---

## Configuration Profiles

| Profile | File | Purpose |
|---|---|---|
| `local` (default) | `application-local.yml` | Local dev — `ddl-auto: update`, SQL logging on |
| `prod` | `application-prod.yml` (on server) | Production — `ddl-auto: validate`, SQL logging off |

Profile is selected via the Maven `-P` flag at build time, which sets `spring.profiles.active`.

---

## Production Build

```bash
mvn clean package \
    --batch-mode \
    --no-transfer-progress \
    -P prod \
    -DskipTests
```

The WAR lands at `db-world-backend/db-world.war`. The Jenkins pipeline copies it to the staging directory and calls `dbworldctl update` to deploy.

---

## Project Structure

```
src/main/java/com/db/dbworld/
├── app/
│   ├── cinema/          # Catalog, TMDB sync, ingestion pipeline, streaming
│   ├── media/           # File watcher, media info, symlinks
│   └── ...
├── config/              # Spring MVC, Security, WebSocket, SPA config
├── security/            # JWT filter, RSA key loading, auth endpoints
├── infrastructure/      # Logging service, log viewer, audit
├── admin/               # Admin-only REST controllers
├── services/            # Aria2, explorer, server-info
├── core/                # Exception types, base response wrapper
└── utils/               # Path resolver, file identity, runtime properties
```

```
src/main/resources/
├── application.yml           # Shared defaults
├── application-local.yml     # Local overrides (gitignored if contains secrets)
├── log4j2.xml                # Async logging config (JSON + rolling file)
└── public/                   # Frontend dist — populated at build time
```

---

## API Documentation

Swagger UI (local): `http://localhost:8080/swagger-ui/index.html`

All endpoints follow a common response envelope:

```json
{
  "httpStatusCode": 200,
  "success": true,
  "message": "...",
  "data": { }
}
```

Authentication uses a Bearer JWT in the `Authorization` header. Tokens are issued at `/api/auth/login` and refreshed via an `HttpOnly` refresh-token cookie.
