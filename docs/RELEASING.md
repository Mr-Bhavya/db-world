# Releasing & Deploying DB World

The full CI/CD flow: how code goes from a branch to a running deployment and an
auto-updating Android app. All automation lives in [`.github/workflows/`](../.github/workflows/)
(see its [README](../.github/workflows/README.md) for per-workflow details + secrets).

## Branches
- **feature branches** → merged into **`development`** (integration).
- **`development`** → promoted to **`main`** via Pull Request. `main` is the
  default, protected branch (direct pushes are rejected — PR required).
- Releases are tagged on **`main`**.

## The pipeline at a glance

```
 feature ──►(merge)──► development ──►(PR)──► main ──►(tag vX.Y.Z)
                            │                 │              │
                        ci.yml (lint+compile) │              ▼
                                                       release.yml  (cloud runners)
                                              builds WAR + frontend dist.zip +
                                              signed APK + version.json
                                              → GitHub Release  ┐
                                                                │
    Actions ▸ Deploy to Pi ──►(self-hosted runner on the Pi)◄──┘
        downloads that release's WAR/dist → dbworldctl + /var/www/dbworld
                                                                │
    Android app on launch ─► GET /api/app/version ─► backend proxies the
        latest Release's version.json ─► app self-updates from GitHub
```

Three workflows:
| Workflow | Runs on | Trigger | Does |
|----------|---------|---------|------|
| `ci.yml` | cloud | push/PR to `development`,`main` | lint frontend + compile backend |
| `release.yml` | cloud | push tag `v*` (or manual) | build WAR, frontend zip, signed APK, `version.json` → GitHub Release |
| `deploy.yml` | **self-hosted (Pi)** | manual | download a release's artifacts → deploy to the Pi |

## Release + deploy the next version

**1. Promote `development` → `main`** (PR, because `main` is protected)
- Open: `https://github.com/Mr-Bhavya/db-world/compare/main...development`
- CI runs on the PR → **Merge**.

**2. Tag the release on `main`**
```bash
git checkout main && git pull
git tag v3.0.1
git push origin v3.0.1
```
`release.yml` fires and publishes a **GitHub Release `v3.0.1`** with `db-world.war`,
`db-world-frontend-dist.zip`, `db-world-3.0.1.apk`, and `version.json`.
*(Alternative: Actions ▸ Release ▸ Run workflow — lets you set versionName + an explicit versionCode.)*

**3. Deploy to the Pi**
- **Actions ▸ Deploy to Pi (self-hosted) ▸ Run workflow**
- Enter tag `v3.0.1` (a bare `3.0.1` also works), part `full` / `frontend` / `backend`.
- The Pi runner pulls the release's artifacts → `dbworldctl update` (backend) and
  a new `/var/www/dbworld/releases/<ts>` symlinked as `current` (frontend).

**4. The Android app updates itself**
- On launch it calls `/api/app/version`; the backend returns the latest Release's
  `version.json`; if that **versionCode > installed**, the app offers the update and
  downloads the APK (`/api/app/download` → 302 → GitHub). No manual APK distribution.

## versionCode
- Auto: a monotonic **date stamp `yymmddHH` (UTC)** — always increasing and above any
  small hand-set codes, so updates are reliably offered. No manual bumping.
- Override via the **Run workflow → `versionCode`** input for edge cases (or if two
  releases go out in the same UTC hour).
- The APK is signed with the keystore in the `ANDROID_*` secrets — it **must stay the
  same keystore** as installed apps, or Android refuses the update.

## Rollback
Deploys are tag-based and repeatable: run **Deploy to Pi** again with a previous tag
(e.g. `v3.0.0`) to redeploy those exact artifacts.

## Prerequisites (one-time)
- **Release secrets** (repo → Settings → Secrets → Actions): `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and
  (optional) `FRONTEND_ENV_PRODUCTION`.
- **Self-hosted runner** on the Pi, running as a service; its user has NOPASSWD sudo
  for `/usr/local/bin/dbworldctl`, write access to `/var/www/dbworld`, and `curl`+`unzip`.
- The Pi needs outbound access to `github.com` / `api.github.com`.

## Relationship to Jenkins
This overlaps the Jenkins pipeline (`db-world-config/server_config/Jenkinsfile`). Use
**one** deploy path — the GitHub Actions deploy here, or Jenkins — not both.
