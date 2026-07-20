# GitHub Actions workflows

Public repo → GitHub-hosted runners are **free & unlimited**, so CI/CD here costs nothing.

| Workflow | Trigger | What it does | Needs setup? |
|----------|---------|--------------|--------------|
| [`ci.yml`](ci.yml) | push / PR to `development`,`main`; manual | Lint frontend (ESLint) + compile backend (JDK 25) | No — works immediately |
| [`release.yml`](release.yml) | push tag `v*`; manual | Build the backend WAR and attach it to a GitHub Release | No (frontend/APK optional) |
| [`deploy.yml`](deploy.yml) | manual | Build + deploy to the Pi (mirrors Jenkins) | **Yes** — self-hosted runner + `production` env |

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
- For a production frontend bundle in `release.yml`, add `.env.production` as a secret and write it before `npm run build:production`.

## `deploy.yml` prerequisites
1. **Self-hosted runner** on the Pi (Settings → Actions → Runners → New self-hosted runner) with the label `dbworldpi`.
2. A **`production` Environment** (Settings → Environments), optionally with a required reviewer for approval gating.
3. Runner user can `sudo dbworldctl` and write to `/var/www/dbworld`; `/etc/dbworld/.env.production` present.
