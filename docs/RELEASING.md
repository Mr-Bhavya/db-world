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

**Backend and app are separate tracks** — a backend change never rebuilds the APK,
and an app release never rebuilds the WAR. Everything is built on GitHub runners; the
Pi only downloads + deploys.

```
 feature ─(merge)─► development ─(PR)─► main
                        │                │
                    ci.yml         ┌─────┴─────────────┐
               (lint+compile)  (tag vX.Y.Z)     (backend change)
                                    │                  │
                             release.yml          backend.yml     (cloud runners)
                        frontend dist +          builds the WAR
                        signed APK +             → rolling `backend-latest`
                        version.json             prerelease
                        → GitHub Release             │
                                    │                │
   Actions ▸ Deploy to Pi ─(self-hosted runner on the Pi)
        frontend ◄ app release dist        backend ◄ backend-latest WAR
             → /var/www/dbworld                 → dbworldctl
                                    │
   Android app on launch ─► GET /api/app/version ─► backend returns the latest
        app Release's version.json ─► self-updates from GitHub
```

| Workflow | Runs on | Trigger | Builds |
|----------|---------|---------|--------|
| `ci.yml` | cloud | push/PR to `development`,`main` | lint FE + compile BE (checks only) |
| `release.yml` | cloud | tag `v*` (or manual) | **app**: frontend zip + signed APK + `version.json` → Release |
| `backend.yml` | cloud | push to `main` under `db-world-backend/**` (or manual) | **backend**: WAR → rolling `backend-latest` prerelease |
| `deploy.yml` | **Pi (self-hosted)** | manual | download + deploy (backend ← `backend-latest`, frontend ← app release) |

## Ship a change

Both start by promoting to `main` (PR, because `main` is protected):
open `https://github.com/Mr-Bhavya/db-world/compare/main...development` → CI runs → **Merge**.

**Backend-only change**
1. `backend.yml` runs automatically on the merge (or run it manually) → refreshes the
   `backend-latest` prerelease WAR. No APK is built.
2. **Actions ▸ Deploy to Pi ▸ Run workflow** → part **`backend`**. Pulls the
   `backend-latest` WAR → `dbworldctl update`.

**Frontend / Android change (app release)**
1. Tag it on `main`:
   ```bash
   git checkout main && git pull
   git tag v3.0.1 && git push origin v3.0.1
   ```
   `release.yml` publishes **Release `v3.0.1`** with `db-world-frontend-dist.zip`,
   `db-world-3.0.1.apk`, and `version.json` (no WAR).
   *(Alternative: Actions ▸ Release ▸ Run workflow — set versionName + explicit versionCode.)*
2. **Actions ▸ Deploy to Pi ▸ Run workflow** → part **`frontend`**, appTag `v3.0.1`
   (blank = latest app release). Deploys the dist under `/var/www/dbworld`.
3. **The Android app self-updates**: on launch `/api/app/version` returns the release's
   `version.json`; if **versionCode > installed**, it downloads + installs the APK
   (`/api/app/download` → 302 → GitHub). No manual APK distribution.

**Both changed?** Deploy with part **`full`** (pulls `backend-latest` + the app release).

## versionCode
- Auto: a monotonic **date stamp `yymmddHH` (UTC)** — always increasing and above any
  small hand-set codes, so updates are reliably offered. No manual bumping.
- Override via the **Run workflow → `versionCode`** input for edge cases (or if two
  releases go out in the same UTC hour).
- The APK is signed with the keystore in the `ANDROID_*` secrets — it **must stay the
  same keystore** as installed apps, or Android refuses the update.

## Rollback
- **Frontend**: run **Deploy to Pi** again with an older `appTag` (e.g. `v3.0.0`) to
  redeploy that release's dist.
- **Backend**: `backend-latest` is rolling (no history). To roll back, run `backend.yml`
  manually from an older commit/branch (Run workflow → pick the ref) to rebuild the WAR,
  then deploy part `backend`.

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
