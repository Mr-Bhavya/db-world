# GitHub Actions workflows

Public repo → GitHub-hosted runners are **free & unlimited**, so CI/CD here costs nothing.

| Workflow | Trigger | What it does | Needs setup? |
|----------|---------|--------------|--------------|
| [`ci.yml`](ci.yml) | push / PR to `development`,`main`; manual | Lint frontend (ESLint) + compile backend (JDK 25) | No — works immediately |
| [`release.yml`](release.yml) | push tag `v*`; manual | Build + attach **WAR** (deploy), **frontend dist zip** (deploy), **APK** (public), and **version.json** (updater metadata) to a GitHub Release | APK needs signing secrets; frontend env optional |
| [`deploy.yml`](deploy.yml) | manual (tag) | Download a release's artifacts and deploy them to the Pi | **Yes** — self-hosted runner + `production` env |

## Relationship to Jenkins
These **complement** the Jenkins pipeline (`db-world-config/server_config/Jenkinsfile`), which still owns the real Pi build + deploy. Recommended split:
- **Actions** = fast PR checks (`ci.yml`) + published artifacts (`release.yml`)
- **Jenkins** = build + deploy to the Pi

`deploy.yml` is an *optional* Actions alternative to the Jenkins deploy — use one or the other, not both.

## First run / how to test
- `ci.yml` runs automatically on PRs to `development`/`main`, or trigger it manually: **Actions tab → CI → Run workflow**.
- Heads-up: `ci.yml` lints all of `db-world-frontend/src`, so the first run may surface pre-existing lint issues outside the cinema module.

## Secrets & security (public repo)
- Never commit secrets. Store them in **Settings → Secrets and variables → Actions** and reference as `${{ secrets.NAME }}`.
- GitHub withholds secrets from workflows triggered by **fork PRs**, so external contributors can't read your deploy keys.

### `release.yml` secrets
| Secret | Purpose | Without it |
|--------|---------|-----------|
| `ANDROID_KEYSTORE_BASE64` | base64 of your release keystore (`.jks`) | APK is **debug-signed** — not valid for public release |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password | ↑ |
| `ANDROID_KEY_ALIAS` | signing key alias | ↑ |
| `ANDROID_KEY_PASSWORD` | key password | ↑ |
| `FRONTEND_ENV_PRODUCTION` | full contents of `runtime/.env.production` | frontend builds with **default env** |

Encode the keystore once: `base64 -w0 your-release.jks` (or `certutil -encode` on Windows) → paste as `ANDROID_KEYSTORE_BASE64`.

### Cutting a release
`git tag v3.0.0 && git push origin v3.0.0` (or Actions → Release → Run workflow). The APK build uses **JDK 17** (AGP breaks on 25); versionName comes from the tag and versionCode defaults to the run number (override via manual dispatch).

### In-app updater ↔ GitHub releases
Each release ships a **`version.json`** (`versionCode`, `versionName`, `apkUrl`, `mandatory`, `minSupportedCode`, `changelog`) — the exact shape the Android updater (`AppUpdateGate` → `GET /api/app/version`) already expects. To make the updater serve the GitHub release APK, point the backend's `/api/app/version` at the latest release's `version.json` (backend proxy — recommended; the app stays unchanged). `versionCode` auto-increments from the workflow run number — keep it ahead of any code already installed on devices (use the manual `versionCode` input to set a high starting value once).

## `deploy.yml` prerequisites
Deploys the artifacts from an existing release, so **build a release first** (`v*` tag).
1. **Self-hosted runner** on the Pi (Settings → Actions → Runners → New self-hosted runner) — default labels are fine (`runs-on: self-hosted`). Install as a **service** so it survives reboot/logout: `sudo ./svc.sh install && sudo ./svc.sh start`. **The workflow must also be on the repo's default branch** for the manual "Run workflow" button to appear.
2. A **`production` Environment** (Settings → Environments), optionally with a required reviewer for approval gating.
3. Runner user can `sudo /usr/local/bin/dbworldctl` (NOPASSWD) and write to `/var/www/dbworld`; `curl` + `unzip` installed.
4. Run it: **Actions → Deploy to Pi → Run workflow**, enter the tag (e.g. `v3.0.0`) + part.
