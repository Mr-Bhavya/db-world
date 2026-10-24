# Moving the Pi's production stack into Docker: plan

Written 2026-10-05. **Approved 2026-10-07**, with the decisions in section 4 (some differ from the
first draft; section 4 is the one that counts). Everything under "Verified" was read on the Pi
without sudo, or in the two repos (`development` aac254e1, config `master` a543ea8).

---

## 1. Verified, and what it changes

### Blockers and mismatches in what already exists

| # | Finding | Consequence |
|---|---|---|
| 1 | **`docker compose` is not installed.** Ubuntu's `docker.io` 29.1.3 ships without the Compose v2 plugin (`docker: unknown command: docker compose`). `docker-compose-v2` 2.40.3 is in noble/universe. | `dbworld-compose` cannot run at all today. Phase 0 installs the package. |
| 2 | `docker.io` comes from **noble-security**, and there is no `/etc/docker/daemon.json`. | Unattended-upgrades will restart dockerd one morning, and without `live-restore` every container restarts with it (MySQL too, once it moves). |
| 3 | Mounts in `compose.yml` that do not match the Pi: `/home/dbworld_admin/ext_hdisk_1` (gone), `/etc/dbworld/cookies` (does not exist; the app uses `/app/db_world/cookies`), and `/opt/db_world/runtime` and `/opt/db_world/config` (neither exists). | Docker would create empty root-owned directories. They go. |
| 4 | Missing mount: `/etc/dbworld/firebase-service-account.json`. `FcmPushSender` reads the path from `FCM_SERVICE_ACCOUNT_FILE`. | Without it, push notifications go silently inactive in the container (it only logs a WARN). |
| 5 | The JWT keys: `/opt/db_world` holds `rsa-*.key` directly, and `runtime/` does not exist. So the live app must be getting `JWT_PUBLIC_KEY`/`JWT_PRIVATE_KEY` from the env file. | Preflight checks that both are non-empty in the parse Compose sees. The loose `.key` files look unused. |
| 6 | `dbworld-compose` and the Dockerfile `HEALTHCHECK` use `localhost:9090`. Since `harden app`, the app listens only on `127.0.0.1` (`[::ffff:127.0.0.1]:9090`). | Health checks go to 127.0.0.1, matching dbworldctl. |
| 7 | `SERVICE_USER` is read from `db_world.service`'s `User=`, falling back to `dbworld_admin`, in both dbworldctl and dbworld-compose. | Once the app no longer runs from that unit it is the wrong source, and the fallback is wrong too. It becomes the constant `dbworld` (995:1004). |
| 8 | **Repo drift:** the repo's `conf.d/02-tunnel-only.conf` still has www/api/root commented out; the live file has all three enabled. | Re-installing nginx config from the repo would silently drop the tunnel locks. Fixed in Phase 0. |
| 9 | `nginx.conf` does `include modules-enabled/*.conf`, which loads 10 dynamic modules (lua, geoip2, echo, dav, pam…). Only `stream` is used. | A container would need every one of those `.so` files. Phase 0 replaces the include with `load_module modules/ngx_stream_module.so;` and tests it on the host nginx first. |
| 10 | Host-side hooks that hard-code host services: the logrotate nginx `postrotate` sends `kill -USR1 $(cat /run/nginx.pid)`, the certbot deploy hook `nginx-reload.sh`, the packaged `/etc/logrotate.d/mysql-server` (`systemctl is-active mysql \|\| exit 0`), and `dbworldctl nginx-reload`/`cert-renew`. | Each one breaks *silently* once its service is a container: logs stop rotating, a renewed cert isn't loaded. All of them go through one runtime-aware helper. |
| 11 | `dbworldctl cert-renew` runs `certbot renew --nginx`, but the only lineage (`db-world.in-0001`) uses `dns-cloudflare`. | Existing bug: `--nginx` overrides the authenticator. Fixed while I'm in there. |
| 12 | The aria2 sandbox drop-in still lists `-/ext_hdisk/dbworld/aria2`. | Stale path; removed from `harden.sh`. |

### App behaviour inside a container (backend sweep of `development`)

- **System Info page:** `LinuxServerInfoCollector` and `RaspberryPiServerInfoCollector` run `systemctl`, `vcgencmd`,
  `ps aux`, `dpkg-query`, `lsusb`, `lspci`, `dmidecode`, `ss`, `ip`… In a container:
  - the service list is empty;
  - vcgencmd (temperature, throttling, voltages) fails;
  - ps and dpkg show the container's own;
  - `/proc/meminfo`, loadavg and uptime are still the host's, and so is networking (host network).

  An app change is needed (decision Q7).
- **Logs:** nothing reads `app.log` or stdout. LogsService reads the log4j2 files and the nginx, aria2 and mysql
  files under `/app/db_world/logs`, so same-path mounts keep the Logs page working as it does now.
- **Mount hazard:** at startup `AppProperties.createDirs()` creates data, temp, streams, downloads and symlinks. If the
  container starts before the USB HDD is mounted, it builds that tree on the SD card *under* the mount point. The bind
  mount then keeps the SD directory even after the HDD mounts. (Today the same thing happens, minus the "keeps".)
- **Host actions:** requests are written with the default umask as the container's UID/GID. 995:1004 is group
  `dbworld`, which is exactly what the spool's 2770/2750 modes expect.
  - The restart allowlist (`nginx redis-server aria2 smbd`) is in both `HostActionValidator` and `hostActionsUtils.js`.
  - The tools sidebar maps to doctor ids `svc.aria2`, `svc.cloudbeaver`, `svc.pironman5` and `svc.cloudflared`, and alerts dedupe on ids like `svc.db_world`.

  **Conclusion: keep every logical name and every doctor id stable, so no app or console change is needed for that.**
- **Still the same:** the tools come from PATH (`ffmpeg`, `ffprobe`, `7z`, `mediainfo`, `yt-dlp`), all of which are in the image. `java.io.tmpdir` holds storyboard tiles,
  poster temp files and Jetty's work directory, the same as today's `PrivateTmp`. Symlinks are relative. `TZ=Asia/Kolkata` covers every `ZoneId.systemDefault`.
  `app.paths.external-videos` still points at the dead `/home/dbworld_admin/ext_hdisk_1/videos`, which `ProtectHome=true` already
  makes unreachable today, so dropping the mount loses nothing.

### Resources

- **Memory:** 7.9 GB total, **3.9 GB available, no swap**. Biggest users:

  | Process | RSS |
  |---|---|
  | app (java) | 2.26 GB |
  | mysqld | 0.63 GB (0.97 GB counting its page cache) |
  | CloudBeaver | 0.26 GB |
  | influxd | 0.20 GB |
  | runner | 0.13 GB |
  | dockerd + containerd | 0.12 GB |

  Containers on the host network add only a shim each (about 10–15 MB).
- **Disk:** `/` (SD) is 29 GB with 12 GB free. `/srv/dbworld` (HDD) is 916 GB with 191 GB free (80%), mounted `nofail,x-systemd.device-timeout=30`.
- **UIDs:** dbworld 995:1004, mysql 109:111, redis 110:112, www-data 33:33.
- **Versions:** MySQL 8.0.46-0ubuntu0.24.04.4, Redis 7.0.15, nginx 1.24.0, aria2 1.37.0, certbot 2.9.0 (dns-cloudflare), cloudflared 2026.9.3, OpenJDK 25.0.4.1.
- **GHCR:** `ghcr.io/mr-bhavya/db-world-backend` is **private** (an anonymous token request is refused).
- **Branch:** `feat/docker-app-image` (a5d4e6fb) only touches four files, and none of them changed on `development` since its branch point (537f8002). The merge will be clean.

---

## 2. Target design

```
                 Cloudflare ──tunnel──▶ cloudflared (HOST) ──▶ 127.0.0.1:443
                 cdn A record ─router 443─────────────────────▶ 0.0.0.0:443
 ┌──────────────────────────── host network namespace (no ports published) ─────────────────────────┐
 │ dbworld-nginx (:80 :443 :8443 :2222)  dbworld-app (127.0.0.1:9090)  dbworld-aria2 (127.0.0.1:6800)  │
 │ dbworld-redis (127.0.0.1, ::1 :6379)  dbworld-mysql (127.0.0.1,127.0.1.1:3306, socket /run/mysqld)  │
 │ cloudbeaver (:8978, as today)                                                                    │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
 HOST: sshd, ufw, fail2ban, samba, pironman5 + influxdb, cloudflared, docker, GitHub runner,
       dbworldctl timers (backup-db, backup-system, doctor, cleanup, actions broker), certbot timer → container
```

Principles. Each one is there to keep something that already works working:

1. **Every container uses `network_mode: host`, and `ports:` is banned (lint).** Each listener, bind address and
   ufw rule stays byte-for-byte the same. So do the tunnel locks (`$realip_remote_addr = 127.0.0.1`), the real-IP trust,
   and `harden`'s consumer-side checks. Docker can't route around ufw because it publishes nothing. On top of that, `daemon.json`
   turns off Docker's iptables management and the default bridge (Q10), so it can't happen by accident either.
2. **Bind mounts only, at the same paths, as the same UIDs. No named volumes.** Every byte of state stays where it is now.
   - The nightly system image, Samba and the backups don't change.
   - Reverting a service means starting the host package again *on the same data*.
3. **systemd supervises each container** (`dbworld-<svc>.service` runs `docker compose up <svc>` attached), and Compose
   stays the single declaration of how each one runs (Q1). What that buys:
   - boot ordering (app after mysql/redis);
   - `RequiresMountsFor=/srv/dbworld`, which closes the mount hazard above;
   - `Conflicts=` with the host unit, so the two can never run at once;
   - `systemctl`/journal/`NRestarts` for the doctor;
   - the same pattern CloudBeaver already uses.
   `ExecStartPost` waits for the container's healthcheck, so "active" means *ready*.
4. **Logical service names don't change.** A new `dbworldctl.d/runtime.sh` maps `db_world | redis-server | aria2 | nginx | mysql`
   to whichever unit is live, with `svc_start/stop/restart/reload/is_active/health/exec`. The doctor, the actions broker,
   `harden`, `app-account`, `backup-system`, `restore-db`, logrotate and certbot all call it. Doctor ids, the console allowlist and
   `HEALTH_SERVICES` keep their names.
5. **One switch and one revert per service:**
   - `dbworld-compose switch <svc>`: stop and mask the host unit, start the container, check it from the consumer's side,
     and auto-revert on failure.
   - `revert <svc>` is the inverse.

   Host packages stay installed and masked until Phase 5.
6. **Images:**
   - The backend comes from the existing Dockerfile.
   - nginx, MySQL, Redis and aria2 get thin images of our own **built from Ubuntu noble's packages**, so they run exactly the
     versions that run now, with Ubuntu's security fixes, rebuilt weekly (Q2).
   - The images are built in the public app repo, since free arm64 runners are for public repos only.
   - Tags carry the package version plus a hash of the image's package list, so a new tag appears only when something actually changed.

### Hardening per container

All of them get `no-new-privileges`, `cap_drop: ALL`, `init`, `pull_policy: never` (only dbworld-compose pulls), capped json-file
logs, `TZ=Asia/Kolkata` and `C.UTF-8`.

| Service | User | Extra caps | Root fs | Mem limit* | Writable mounts |
|---|---|---|---|---|---|
| app | 995:1004 | – | rw (`/tmp`, `HOME`) | 4g, `oom_score_adj -500`, pids 4096, nofile 65536 | `/app/db_world`, `/srv/dbworld`, `actions/requests` |
| redis | 110:112 | – | read-only | 512m | `/var/lib/redis`, `/var/log/redis` |
| aria2 | 995:1004 (umask 002) | – | read-only | 512m | `/srv/dbworld`, `conf/aria2`, `logs/aria2` |
| nginx | root master, www-data workers | NET_BIND_SERVICE, SETUID, SETGID, CHOWN, DAC_OVERRIDE† | read-only + tmpfs `/run` | 512m | `/app/db_world/logs/nginx`, `/var/lib/nginx` |
| mysql | 109:111 | – | read-only + tmpfs `/tmp` | 2g | `/var/lib/mysql`, `/run/mysqld` (shared with host), `/var/log/mysql` |

\* Ceilings, not reservations: with no swap, a runaway ffmpeg or a torrent gets killed inside its own container instead of the
kernel OOM-killing MySQL. The app's limit includes the ffmpeg, 7z and yt-dlp children it starts.
† Its logs are `dbworld:dbworld 0640` and `/etc/nginx/ssl/default.key` belongs to dbworld_admin. On the host, root reads them
through DAC_OVERRIDE; container root needs it granted explicitly.

Sharing `/run/mysqld` is what keeps every host tool working unchanged against the MySQL container:
- `backup-db`'s mysqldump;
- `security`'s root-by-socket login;
- `debian-sys-maint` and logrotate's flush.

Containers on the host network get the host's `/etc/hosts`, so `DB_HOST=dbworldpi` (127.0.1.1) still resolves.

### Storage (the SD card is failing, with 12 GB free)

- **Keep `data-root` at `/var/lib/docker`** on the root filesystem. It moves to the NVMe together with the system in
  `migrate-to-nvme`. Not the HDD: the HDD enumerates late or not at all at boot, it's 80% full, and MySQL would then depend on it.
- **The images take about 3–4 GB** (the current and previous of each). Docker only writes to the SD during a pull. The card's
  failing sectors are in the boot partition, and the root filesystem has shown no errors.
- **The nightly image includes `/var/lib/docker`, so a restore boots a working site with no GHCR and no network.**
  - Images are immutable, so the nightly rsync only moves new layers.
  - It excludes only `/var/lib/docker/containers/*/*-json.log*`.
  - There are no volumes to worry about (principle 2). MySQL keeps its consistent pass 2: `systemctl stop mysql` becomes `svc_stop mysql`.
  - Image root ≈ 16 GB used + 4 GB of images + 20% = about 24 GB, which still fits the 27.6 GB restore limit for a 32 GB card.

---

## 3. Phases

The order: Phase 0 → 1 → 2 → 3 → 4 → 5. Each phase stands on its own and has its own revert. The rest of
the stack is unaffected by reverting one service.

### Phase 0: foundations. No service changes; the CloudBeaver blip is the only exception

**App repo**, new branch `feat/docker-stack` off `development`:
- Merge `origin/feat/docker-app-image` (a5d4e6fb), which is clean.
- `db-world-backend/Dockerfile`:
  - HEALTHCHECK on `127.0.0.1`;
  - `iproute2` and `procps`, so the network and process panels still have their tools;
  - fix the comments (`dbworld`, not dbworld_admin);
  - bump the yt-dlp pin.
- New `deploy/images/{nginx,redis,aria2,mysql}/Dockerfile`. Each is `ubuntu:24.04` plus the noble package (`nginx` + `libnginx-mod-stream`,
  `redis-server`, `aria2`, `mysql-server-core-8.0` + `mysql-client-core-8.0`), plus `tzdata` and a healthcheck tool. No config is baked in.
- New `.github/workflows/infra-images.yml`. It builds the four for arm64 on change and weekly (cron), and pushes only when the package set changed.
  It writes the versions into the run summary.
- `deploy.yml`:
  - the docker deploy step becomes `sudo /usr/local/bin/dbworld-compose deploy app "$TAG"`;
  - while the Pi is still on the WAR, `deploy` only stages the image (pull, WAR extract) and says so, instead of failing.

**Config repo** (`master`):
- `compose.yml` is rewritten for all five services (section 2). Only enabled units run, so unused definitions are inert.
  Tags and UIDs come from `/etc/dbworld/compose.env`, which dbworld-compose writes; there are no secrets in it.
- `dbworld-compose` is rewritten. It takes a fixed service list and validates tags (`^sha-[0-9a-f]{12}$` for the app, the infra tag pattern for the others).

  | Command | What it does |
  |---|---|
  | `preflight [svc]` | Checks compose and the daemon, lints the config (no `ports`, no named volumes, host network everywhere, nothing privileged), checks every bind source and its owner. For the app it compares the env parse **systemd vs Compose by hash and prints only the names of variables that differ** (Compose interpolates `$` and treats quotes differently). It also checks that the JWT and FCM inputs are present. |
  | `pull <svc> <tag>` | Pulls an image. |
  | `deploy <svc> <tag>` | Pulls, restarts, health-checks, and automatically goes back to the previous tag on failure. For the app it also extracts the image's WAR to `/opt/db_world/db-world.war`, so the WAR fallback is always the same code. |
  | `switch` / `revert <svc>` | Moves one service from host to container, or back. |
  | `rollback <svc>` | Back to the previous tag. |
  | `rehearse mysql` | Phase 4's dry run. |
  | `wait-healthy <svc> <secs>` | Waits for the healthcheck; used by the units. |
  | `status`, `logs <svc>` | Every service's runtime, tag, unit state, health and image age; the container's log. |
- New units `dbworld-{app,redis,aria2,nginx,mysql}.service`, `dbworld-certbot.{service,timer}`, and optionally
  `dbworld-images-update.{service,timer}` (Q8). Each has `Requires=docker.service` and `Conflicts=<host unit>`, `ExecStartPost=dbworld-compose wait-healthy`,
  and `Restart=on-failure`. App and aria2 have `RequiresMountsFor=/srv/dbworld` (Q6). The app keeps
  `StandardOutput=append:/app/db_world/logs/app.log`, so `dbworldctl logs` keeps working.
- New `docker/daemon.json`: `live-restore`, json-file 10m×2, `iptables:false`, `ip6tables:false`, `bridge:"none"` (Q10).
- dbworldctl:
  - new module `runtime.sh`, added to `DBWORLDCTL_MODULES`;
  - `SERVICE_USER` becomes the constant `dbworld`;
  - `HEALTH_SERVICES` stays logical, plus `docker`.

  | Module | Change |
  |---|---|
  | `service.sh` | start/stop/restart/status follow the runtime. |
  | `backend.sh` | `update`/`rollback` hand over to `dbworld-compose` when the app is a container. |
  | `health.sh` | `svc.*` checks the live unit plus container health. New checks: `docker.daemon`, `docker.lint`, `image.<svc>.age` (warn after 30 days, the patch reminder). "Who runs what" reports containers by their configured user and caps. |
  | `actions.sh` | `service-restart` follows the runtime; `nginx -t` runs inside the container. |
  | `harden.sh` | Restarts follow the runtime. The aria2 item reports the container sandbox instead of writing a systemd drop-in. The stale `/ext_hdisk` path goes. |
  | `app-account.sh` | Container mode: status only; `--undo` refuses until the app is reverted. |
  | `database.sh` | `restore-db` stops and starts the app through the runtime. |
  | `system-image.sh` | `svc_stop/start mysql`, and the json-log exclude. |
  | `infra.sh` | `nginx-reload`, the new `nginx-reopen` and `cert-renew` follow the runtime (and lose `--nginx`); new `mysql-flush-logs`. |
  | `help.sh`, completion | Updated. |
- `logrotate-dbworld`: postrotate becomes `dbworldctl nginx-reopen`.
- New `letsencrypt/nginx-reload.sh` (the deploy hook) calls `dbworldctl nginx-reload`.
- `nginx.conf`: `load_module` instead of `modules-enabled`. `conf.d/02-tunnel-only.conf` is synced with the live file.
- `install-dbworldctl.sh` also installs compose.yml, dbworld-compose and the units, without enabling any of them. It does not touch daemon.json: that restarts docker.
- New `sudoers.d/dbworld-deploy`: the runner can run `dbworld-compose deploy app *` and `dbworldctl publish-frontend *` without a
  password, and nothing else. `dbworldctl update *` stays until Phase 1 is proven.
  - Both commands validate their arguments.
  - `publish-frontend` refuses symlinks and files not owned by the caller, because `cp` running as root through a symlink would copy any root-readable file somewhere the app can read.
  - This replaces the current any-arguments `dbworldctl` rule, which is root-equivalent (`dbworldctl env` opens vi).
- Docs:
  - DOCKER.md rewritten: Ubuntu `docker.io` + `docker-compose-v2`, every phase, every revert;
  - TUNNEL.md and ACCESS.md: "nginx and cloudflared must stay on the host network";
  - CLOUDBEAVER.md: the daemon.json note;
  - SETUP.txt.

**Pi (you run these):**
```bash
sudo apt-get update && sudo apt-get install -y docker-compose-v2
```
```bash
sudo install -m 644 /tmp/dbworld-docker/daemon.json /etc/docker/daemon.json && sudo systemctl restart docker && sudo systemctl status cloudbeaver --no-pager
```
```bash
sudo bash /tmp/dbworldctl-install/install-dbworldctl.sh
```
```bash
sudo install -m 644 /tmp/dbworld-docker/nginx.conf /etc/nginx/nginx.conf && sudo dbworldctl nginx-reload
```
```bash
sudo grep -rn dbworldctl /etc/sudoers /etc/sudoers.d/
```
```bash
sudo visudo -cf /tmp/dbworld-docker/dbworld-deploy && sudo install -m 440 /tmp/dbworld-docker/dbworld-deploy /etc/sudoers.d/dbworld-deploy
```
Then remove the old rule the grep found, with `sudo visudo -f <that file>`. Then, for my information (these print names and settings, never values):
```bash
sudo grep -oE '^[A-Z_]+=' /etc/dbworld/dbworld.env | tr '\n' ' '
```
```bash
sudo grep -E '^(bind|port|maxmemory|save|appendonly|dir|supervised|daemonize|unixsocket|logfile)' /etc/redis/redis.conf
```
```bash
sudo du -sh /var/lib/mysql /var/lib/redis /var/lib/docker
```
```bash
sudo dbworld-compose preflight
```
Plus GHCR: make the package public (GitHub → Packages → db-world-backend → settings), or `sudo docker login ghcr.io` (Q5).

**Verify:**
- `docker compose version`;
- CloudBeaver answers again at db.db-world.in;
- `sudo iptables -S | grep -c DOCKER` is 0 after the next reboot;
- `sudo dbworldctl doctor` is all ok;
- `nginx -T` shows stream loaded and the ssh :2222 proxy still answers;
- the deploy runner can do nothing beyond its two commands (`sudo -n -l` as dbworld_admin).

**Risks:** the `docker` restart restarts CloudBeaver (about a minute). A sudoers typo can't lock anything out, since it is `visudo -c`-checked and you keep your password sudo.
**Revert:** delete daemon.json and restart docker; the old installer keeps `.old` copies; the old nginx.conf is kept as `.before-docker`.

### Phase 1: backend. About 90 s of downtime, the time Spring takes to start

**App repo:** the System Info container mode (Q7), so the page doesn't go blank:
- `DBWORLD_RUNTIME=container` comes from compose;
- the service list and hardware come from doctor.json `svc.*`/`hw.*`;
- host-only panels (processes, packages, USB/PCI, vcgencmd extras) are labelled "host only, not visible from the container";
- tests, ESLint and a frontend build.

**Pi:**
1. Deploy & Release with Backend ticked and `backend_runtime=docker`. It builds and pushes `sha-…`. The Pi is still on the WAR, so it only stages the image.
2. Then:
   ```bash
   sudo dbworld-compose preflight app
   ```
   ```bash
   sudo dbworld-compose switch app
   ```

**Verify:**
- `dbworld-compose status`;
- the health check direct and through nginx (`curl --resolve api.db-world.in:443:127.0.0.1`), and the public site from mobile data;
- sign-in (the JWT keys loaded);
- the FCM log line says push is active;
- a scheduler run log;
- ingestion of a .zip and a .rar;
- a yt-dlp download;
- an aria2 download through the app;
- a storyboard is generated;
- new files are owned by 995:1004; log timestamps are IST;
- the Logs page and live logs;
- System Info, Host health and a "Refresh health" server action;
- the doctor shows `svc.db_world` ok;
- container memory after an hour.

**Risks:**
- The Compose env parse differs from systemd's. Preflight catches it; worst case the health check fails and it auto-reverts.
- First-pull SD write errors: auto-revert.

**Revert:** `sudo dbworld-compose revert app`. It starts `db_world.service`, which runs the WAR extracted from the same image (about 60 s).
After a day stable, the deploy workflow defaults to docker and `dbworldctl update *` leaves the sudoers rule.

### Phase 2: Redis, then aria2. Seconds of downtime each

**Pi:** first build the infra images (the workflow on `development`), then:
```bash
sudo dbworld-compose switch redis
```
```bash
sudo dbworld-compose switch aria2
```
`switch aria2` refuses while downloads are running (`--force` to override). The session file means paused downloads resume.

**Verify Redis:**
- `redis-cli -h 127.0.0.1 ping` *and* `-h ::1` (`REDIS_HOST=localhost` can resolve to either; the same lesson as dbworldpi/127.0.1.1);
- app health UP;
- sessions and caches survive (RDB at the same version).

**Verify aria2:**
- `aria2.getVersion` on 127.0.0.1:6800 with the secret;
- nothing listening wider than 6800 (`ss`);
- ariang.db-world.in through the tunnel;
- the app's WebSocket reconnects;
- a test download lands in `/srv/dbworld/temp` as 995:1004 with g+w.

**Risks:** losing the IPv6 loopback bind (verified by the ::1 check); aria2's umask (verified by the g+w check).
**Revert:** `sudo dbworld-compose revert redis` or `revert aria2`. These unmask and start the host units on the same files.

### Phase 3: nginx and certbot. 1–2 s of port handover

**Pi:**
```bash
sudo dbworld-compose switch nginx
```
It runs `nginx -t` in the new image against the live `/etc/nginx` before stopping anything.
```bash
sudo dbworld-compose certbot-dry-run
```
```bash
sudo systemctl disable --now certbot.timer && sudo systemctl enable --now dbworld-certbot.timer
```
certbot runs the official `certbot/dns-cloudflare` image (pinned), with `/etc/letsencrypt` read-write and `ExecStartPost=dbworldctl nginx-reload`.

**Verify:**
- Through the tunnel (`--resolve <host>:443:127.0.0.1`): root, www, api, ariang and cdn all answer 200.
- **The locks:** `curl --interface 192.168.1.12 --resolve www.db-world.in:443:192.168.1.12 …` gets **403** for www, api and root, and 200 for cdn.
- From mobile data, the access log's `real_ip` is the phone's address, not 127.0.0.1. This is the shared rate-limit bucket trap.
- `ssh -p 2222` gives a banner;
- a video seek and a download (`limit_rate`, aio/directio);
- a large upload (body temp is `/var/lib/nginx`);
- `logrotate -f` followed by new log lines appearing;
- `renew --dry-run` passes.

**Risks:**
- Both certs expire 2026-11-29 and renewal starts around 10-30. Do this phase before then, or after a renewal has happened; the host timer stays as a backup until the container has renewed once.
- A missing capability shows up as `nginx -t` or a 403/500, and the switch auto-reverts.

**Revert:** `sudo dbworld-compose revert nginx`; `systemctl enable --now certbot.timer`.

### Phase 4: MySQL. About 1–2 min of downtime. Recommended after the NVMe move (Q4)

Method (Q3): **in place, same build.** The image installs exactly `8.0.46-0ubuntu0.24.04.4`, the package running now. It
mounts the existing `/var/lib/mysql` and `/etc/mysql` (keeping `zz-dbworld.cnf`: 127.0.0.1 and 127.0.1.1) and shares `/run/mysqld`.
Same binary and same datadir, so nothing is converted, and going back is just starting the host mysqld again.
`TZ=Asia/Kolkata` keeps `NOW()` and events unchanged.

**Pi:**
```bash
sudo dbworld-compose rehearse mysql
```
This copies the consistent datadir from last night's image to the HDD, boots the image on it at 127.0.0.1:3310, and runs
`mysqlcheck --all-databases` plus row counts. It touches nothing live, and deletes the copy afterwards. Then, in a quiet hour:
```bash
sudo dbworldctl backup-db && sudo dbworld-compose switch mysql
```
`switch` stops the app, stops and masks mysql.service, starts the container, and checks TCP on 127.0.0.1 **and** 127.0.1.1:3306, 33060 and the socket.
Only then does it start the app.
```bash
sudo apt-mark hold mysql-server-8.0 mysql-server-core-8.0
```
The hold stays on for the soak period, so the host package can't move ahead of the image and break going back.

**Verify:**
- app health and real pages;
- CloudBeaver connects;
- `sudo dbworldctl backup-db` (host mysqldump over the shared socket);
- `sudo dbworldctl security` (root by socket);
- that night's `backup-system` (MySQL down in pass 2, then up);
- `logrotate -d` for /var/log/mysql (the packaged rule is diverted, ours flushes through the socket);
- the doctor is green.

**Risks:**
- A version mismatch, prevented by the pinned version and the apt hold.
- Doing it on the dying SD card: hence the NVMe gate.
- **`apt purge mysql-server-*` can delete `/var/lib/mysql`. Only ever `remove`, never purge.**

**Revert:** `sudo dbworld-compose revert mysql` starts the host mysqld on the same datadir. A restore from the pre-switch dump is the last resort.

### Phase 5: decommission. After about 2 weeks stable, and after the NVMe move

- `apt-get remove` (never purge) `nginx`, `redis-server`, `aria2` and `mysql-server-8.0`. Keep `mysql-client`, `redis-tools` and `curl` for diagnosis.
- Drop the apt hold, the units' `Conflicts=` partners and the masks.
- Keep or remove the WAR fallback (`db_world.service` and the host JDK, Q11).
- Add the removed packages to `prune-software`.
- Rewrite SETUP.txt as "a fresh Pi = Ubuntu + docker.io + compose + restore `/etc/dbworld`, `/etc/nginx`, `/etc/mysql`, the data paths → `dbworld-compose up`".
  This is the drift problem that started all of this.
- Optionally, a restore drill from the system image.

---

## 4. Decisions (answered 2026-10-07)

| # | Decision | How it changes the plan |
|---|---|---|
| Q1 | **systemd unit per container** | As planned. |
| Q2 | **Own images from Ubuntu noble packages**: asked for the least upkeep over the long run | As planned. Ubuntu patches those exact versions until 2029, so there is no forced version move before the next LTS. |
| Q3 | **MySQL in place, same build, as a temporary step**: a move to PostgreSQL is planned later | Keep the MySQL container minimal. compose and runtime.sh take a `postgres` service later without redesign. |
| Q4 | **MySQL now, on the SD card**: not gated on the NVMe | The rehearsal is mandatory. The pre-switch dump is also copied to the HDD (`DB_BACKUP_SCP_TARGET` is unset, so dumps otherwise live only on the SD). Last night's system image must be `ok`. Quiet hour. |
| Q5 | **Make the GHCR packages public** | You flip each package's visibility in GitHub. |
| Q6 | **Start without the HDD, like today, but guarded** | No `RequiresMountsFor`; `After=srv-dbworld.mount` only. See the media-disk guard below. |
| Q7 | **Full host data** on System Info | The host writes `/var/lib/dbworld/health/host-info.json`: captured output of the exact commands and files the collectors use. In a container the collectors read that instead of executing. Live `/proc` metrics stay live. |
| Q8 | **Weekly auto-update** for nginx, Redis and aria2 | Health-checked, with rollback. MySQL manual; the doctor warns on images older than 30 days. |
| Q9 | **certbot in a container plus timer** | The host timer stays as a backup until one real renewal. |
| Q10 | **Docker iptables off, no default bridge** | As planned. |
| Q11 | **WAR fallback until NVMe + 30 days** | As planned. |
| + | **Lock down Samba `[PI_ROOT]`** | Read-only, admin user only. |
| + | **zram swap** | `systemd-zram-generator`, ram/4 with zstd. |
| + | **Runner safety check** | Audit the workflows, plus GitHub settings steps for you. |

**Media-disk guard (from Q6).** A marker file `/srv/dbworld/.dbworld-media-disk` is created once on the HDD itself. The marker
check works the same on the host and in a container, where comparing filesystem device numbers would not. When it is missing:
- Media sync, and every other job that deletes database rows because a file is gone, refuses and records why. This is checked on
  every run, so a disk that drops while the app runs is covered too.
- `AppProperties.createDirs()` no longer builds the media tree on the SD card.
- Ingestion and downloads refuse to start new jobs, so aria2 cannot fill the SD card.

The containers mount `/srv` with `rslave` propagation, so the HDD mounting or unmounting later is seen live, without a restart.

## 4b. Implementation status (2026-10-08)

**Live on the Pi:**
- Phase 0 installed.
- Phase 1: the app, as a container, image `sha-d0b98b0dae68`. Deployed by Deploy & Release, then `switch app`.
- Phase 2: Redis and aria2.
- Phase 3: nginx, plus certbot on `dbworld-certbot.timer` (the dry run passed). The host certbot.timer stays as a backup until the container's first real renewal, which then switches it off.
- Phase 4: MySQL, switched 2026-10-08 14:50 IST (2.5 min of downtime) after a rehearsal on a copy of the night's datadir. Then the rebuilt image `20261008-a0b93947` was deployed (27 s without MySQL).

Problems met and fixed on the way:
- A first container create takes up to ~80 s on the SD card, so wait-healthy now waits it out.
- A failed deploy lost the rollback target.
- The switched-off aria2.service was left "failed".
- The first 1.5 GB image pull took 17 min.
- **The MySQL image's mysqld read none of `/etc/mysql/mysql.conf.d`.** Without the `mysql-server-8.0` package, the `my.cnf` alternative is `my.cnf.fallback`, which includes `conf.d/` only. It therefore had no `lower_case_table_names = 1` and refused the datadir, and no loopback bind. The rehearsal caught it. Fixed by `--defaults-file=/etc/mysql/mysql.cnf` plus the alternative in the image, and every deploy now compares `mysqld --print-defaults` with the reference.
- The MySQL healthcheck (`mysqladmin ping` with no user) logged a `sha256_password` deprecation warning every 15 s, through MySQL's decoy login for unknown accounts. It now names `debian-sys-maint`.

**Phase 5: prepared, not run.** `sudo dbworld-compose decommission` checks and shows what would go; `--yes` does it. It deviates from the plan in three places, each for a reason found while building it:
- **The masks and `Conflicts=` stay.** With them, a reinstalled package cannot start next to its container. `revert` after Phase 5 says what to install first.
- **The removed packages are fenced off from `prune-software`, not added to it.** Their purge scripts delete what the containers run from: nginx-common runs `rm -rf /etc/nginx`, certbot `rm -rf /etc/letsencrypt`, redis-tools `userdel redis` + `rm -rf /var/lib/redis /etc/redis`, and mysql-server-8.0 can delete `/var/lib/mysql`. A plain remove leaves them in the "rc" state, which `prune-software` used to purge wholesale. It now keeps their leftover config (`PRUNE_KEEP_CONFIG_RE`).
- **A temporary `policy-rc.d`** forbids every start and stop during the removal. MySQL's postrm pings mysqld through the shared socket, gets the container's answer, and would otherwise go on to stop "the server" through `invoke-rc.d`.

Also added: `dbworld-compose up`, which starts services straight as containers on a Pi without host packages (`switch` needs a running host service to compare with). `SETUP.txt` is rewritten for the Docker world, and `scripts/setup-linux.sh`, which installed the host packages, is gone. Phase 5 itself waits for the NVMe move, 30 days on the containers, and the certbot container's first real renewal.

Code: db-world `development` (merge `d0b98b0d`), db-world-config `master`.

What follows describes the branch as it was first built:
- **db-world** branch `feat/docker-stack` (off `development` aac254e1, uncommitted):
  - the Docker branch squashed in;
  - Dockerfile fixes;
  - `deploy/images/{nginx,redis,aria2,mysql}` + `infra-images.yml`;
  - `deploy.yml` → `dbworld-compose deploy app`;
  - System Info container mode (`HostInfoSnapshot`; collectors answer from `/run/dbworld/host-info.json`; config.txt fallback);
  - the media-disk guard (merged from its own worktree).
- **db-world-config** `master` (uncommitted), under `server_config/`:
  - `compose.yml` (all services);
  - `dbworld-compose` → `dbworldctl container`;
  - new modules `runtime.sh`, `container.sh`, `hostinfo.sh`;
  - the `dbworld-*` units and timers, `db_world-hostinfo` units;
  - `docker/daemon.json`, `sudoers.d/dbworld-deploy`, `logrotate-mysql-server`, `zram-generator.conf`;
  - `nginx.conf` with explicit `load_module`;
  - `02-tunnel-only.conf` synced with the live file;
  - logrotate nginx-reopen;
  - doctor, actions, harden, app-account, restore-db and backup-system going through the runtime layer;
  - `cert-renew --nginx` bug fixed;
  - `update`/`publish-frontend` refuse what the sudo caller could not read themselves;
  - Samba `PI_ROOT` read-only;
  - DOCKER.md rewritten.

**Order that matters:** the media-disk guard is on in `application-prod.yml`. `sudo dbworldctl
media-disk mark` (Phase 0, with the new dbworldctl installed) must run **before** any backend
deploy of this branch. Otherwise production treats the HDD as missing and refuses media work.
Both deploy paths (`dbworld-compose deploy app`, `dbworldctl update`) stop if the HDD is mounted
but unmarked.

Verification so far:
- Backend suite on the merged `feat/docker-stack`: 1867 tests, 0 failures, 1 skipped. This is
  host-info (1825 in its worktree) plus the media-disk guard (1808 in its worktree) together.
- On the Pi, non-root from `/tmp/dbworld-docker`: `help`, `doctor --json` (all `svc.*` ids unchanged, the new marker check warns as expected) and `host-info` (46 commands in 1.2 s) all work.
- A sandbox harness (fake systemctl/docker/curl) exercises every switch/revert/deploy/rollback path, including the automatic way back on failure.

### The original question list, kept for reference

These were the defaults before the answers above.

| # | Question | Recommended | Alternative |
|---|---|---|---|
| Q1 | Who supervises containers | **systemd unit per container**: boot order, HDD gating, `Conflicts=`, and every `systemctl` consumer keeps working | Docker restart policies: simpler units, but no ordering or mount gating, and every consumer gets ported to `docker` commands |
| Q2 | Where nginx, Redis, aria2 and MySQL images come from | **Our own images from Ubuntu noble packages**: today's exact versions, Ubuntu security fixes, weekly rebuild | Upstream official images: newer versions with behaviour changes. Official MySQL 8.0 is end-of-life since April 2026, so it would mean 8.4 via dump/restore |
| Q3 | MySQL method | **In place, same build**: instant revert | Dump/restore into a new datadir (your brief's plan): slower, and going back after writes loses data. Needed only if the version changes |
| Q4 | Phase 4 timing | **After the NVMe move** | Now, on the SD card |
| Q5 | GHCR access | **Make the packages public**: the image holds only public code, and nothing on the Pi expires | `sudo docker login ghcr.io` with a `read:packages` PAT, which expires and is needed for every restore |
| Q6 | No HDD at boot | **app and aria2 wait for `/srv/dbworld`**: no tree built on the SD, no downloads filling it | Start degraded, as today, and accept the hidden-files / SD-fill risk |
| Q7 | System Info in a container | **Minimal**: services and hardware from doctor.json, host-only panels labelled | Full: the doctor also writes a `host-info.json` (more work, everything shown) |
| Q8 | Patching infra images | **Weekly auto-update for nginx, Redis and aria2** with health-checked rollback; MySQL manual; the doctor warns on old images | All manual (the doctor still warns) |
| Q9 | certbot | **Container plus timer**, host timer as backup until one real renewal | Keep host certbot |
| Q10 | Docker's iptables | **Off** (`iptables:false`, `bridge:none`): ufw is the only firewall | Leave Docker's rules in place |
| Q11 | WAR fallback | **Keep `db_world.service` and the JDK until the NVMe move + 30 days** | Remove in Phase 5 |

---

## 5. After approval: how I'll work

- App repo: `feat/docker-stack` off `development`, in this worktree. Backend: `mvn test`. Frontend: ESLint plus build (no dev server).
- Config repo: edits on `master`, uncommitted. Git writes use PowerShell, never `git add -A`, no Co-Authored-By trailer.
- Scripts: `bash -n`, CRLF check, and smoke tests with fake `docker`/`systemctl`/`curl`, as for the first dbworld-compose.
- I stage files in `/tmp` on the Pi with scp and give you one-line commands. You run every sudo step.
- Nothing is committed, pushed or switched until you say so, phase by phase.
