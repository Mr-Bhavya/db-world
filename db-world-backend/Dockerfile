# syntax=docker/dockerfile:1.7
#
# db-world backend: the Spring Boot WAR plus every command-line tool it runs.
#
# The app shells out to ffmpeg/ffprobe, mediainfo, 7z and yt-dlp by name (app.tools.* in
# application-prod.yml), so they live in this image next to the JVM. MySQL, Redis, aria2 and
# nginx are separate services; on the Pi they stay on the host for now (see compose.yml in
# db-world-config/server_config).
#
# Versions are pinned so a rebuild months from now produces the same tools, and an upgrade is a
# diff somebody chose to make. The base tags pin the Java major and the Ubuntu release, but not
# the patch level: every rebuild picks up their security fixes.
#
#   docker buildx build --platform linux/arm64 -t db-world-backend .      (from db-world-backend/)

# ── Build ─────────────────────────────────────────────────────────────────────
# Bytecode is the same on every platform, so this stage runs natively on the builder rather than
# under emulation when the target is arm64.
FROM --platform=$BUILDPLATFORM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src
COPY pom.xml .
# Dependencies in their own layer, so a code-only change does not download them again. Best
# effort: anything go-offline cannot resolve is fetched by the package step below.
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -q -P prod dependency:go-offline || true
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -P prod -DskipTests package \
 && cp target/db-world.war /db-world.war

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM eclipse-temurin:25-jre-noble

ARG TARGETARCH
# yt-dlp is the one tool expected to move often: YouTube breaks it every few weeks. Bump it here,
# or build with --build-arg YTDLP_VERSION=<release>; the image workflow can pass the newest.
ARG YTDLP_VERSION=2026.08.19
# yt-dlp needs a JavaScript runtime for full YouTube support, and only enables deno by default.
ARG DENO_VERSION=2.9.7

# DEBIAN_FRONTEND keeps tzdata (and anything else) from stopping the build to ask a question.
# 7zip ships /usr/bin/7z; 7zip-rar (multiverse) adds the RAR codec for .rar/.cbr ingestion.
# ffmpeg brings ffprobe.
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ffmpeg mediainfo 7zip 7zip-rar tzdata curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Release binaries, each checked against the checksum file its project publishes.
RUN set -eux; \
    case "$TARGETARCH" in \
      arm64) ytdlp=yt-dlp_linux_aarch64; deno=deno-aarch64-unknown-linux-gnu ;; \
      amd64) ytdlp=yt-dlp_linux;         deno=deno-x86_64-unknown-linux-gnu ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    cd /tmp; \
    url="https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}"; \
    curl -fsSLO "$url/$ytdlp"; \
    curl -fsSL "$url/SHA2-256SUMS" | grep " $ytdlp\$" | sha256sum -c -; \
    install -m 0755 "$ytdlp" /usr/local/bin/yt-dlp; \
    url="https://github.com/denoland/deno/releases/download/v${DENO_VERSION}"; \
    curl -fsSLO "$url/$deno.zip"; \
    curl -fsSL "$url/$deno.zip.sha256sum" | sha256sum -c -; \
    unzip -q "$deno.zip" -d /usr/local/bin; \
    chmod 0755 /usr/local/bin/deno; \
    rm -f /tmp/yt-dlp_* /tmp/deno-*; \
    yt-dlp --version; deno --version; ffmpeg -hide_banner -version | head -1; mediainfo --version; 7z i > /dev/null

# The container runs as the host's dbworld_admin UID (compose.yml), which has no entry in this
# image, so HOME is a directory any UID can write: yt-dlp and deno keep their caches under it.
# TZ matches the Pi: the JVM's default zone drives LocalDate.now() across the app, and a
# container's default is UTC. UTF-8 so file names outside ASCII survive the JVM's file APIs.
ENV HOME=/home/dbworld \
    TZ=Asia/Kolkata \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8
RUN mkdir -p "$HOME" && chmod 1777 "$HOME"

# Same layout as the systemd service: relative paths in application.yml (runtime/rsa-*.key)
# resolve against /opt/db_world.
WORKDIR /opt/db_world
COPY --from=build /db-world.war /opt/db_world/db-world.war

EXPOSE 9090
# Same probe and the same five-minute startup allowance as dbworldctl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
  CMD curl -fsS "http://localhost:${SERVER_PORT:-9090}/actuator/health" > /dev/null || exit 1

# JVM flags come from JDK_JAVA_OPTIONS (set in compose.yml), which the java launcher reads itself,
# so this stays exec-form and Java is PID 1's direct child under `init: true`.
ENTRYPOINT ["java", "-jar", "/opt/db_world/db-world.war"]
