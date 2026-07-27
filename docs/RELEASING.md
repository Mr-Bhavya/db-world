# Releasing & Deploying DB World

How code goes from a branch to a running deployment and an auto-updating Android app. All
automation lives in [`.github/workflows/`](../.github/workflows/). The model is deliberately two
verbs:

- **Build** — make artifacts (WAR / web bundle / debug APK). **Never** deploys or publishes.
- **Deploy & Release** — build **and ship**: WAR + web to the Pi, and the signed APK to a GitHub
  Release. Manual only.

Everything is built on GitHub cloud runners; the Pi only receives deployments.

## Branches
- **feature branches** → merged into **`development`** (integration).
- **`development`** → promoted to **`main`** via Pull Request. `main` is the default, **protected**
  branch (direct pushes rejected — PR required).
- If your `gh`/CLI account is an **Enterprise Managed User**, GitHub blocks it from opening PRs on a
  personal repo — open the `development → main` PR from your **personal** account in the web UI:
  `https://github.com/Mr-Bhavya/db-world/compare/main...development`.

## Workflows

| Workflow | Runs on | Trigger | What it does |
|----------|---------|---------|--------------|
| **CI** | cloud | PR to `development`/`main` + push to `main` | Lint frontend + compile backend (checks only) |
| **Build** | cloud | manual | Build the selected artifact(s) and upload as **workflow artifacts** — no deploy, no publish |
| **Deploy & Release** | cloud **+ Pi** | manual | Build **and ship** the selected component |

Both **Build** and **Deploy & Release** take:
- **`backend` / `frontend` / `android`** — checkboxes; tick any combination (all three = "everything").
- **`ref`** — a branch, tag (e.g. `v3.0.3`) or commit SHA to build. Blank = the ref you launched
  from. This is how you build/ship a **specific version** and how you **roll back** (see below).

**Deploy & Release** also takes (Android only): **`version`** (e.g. `3.1.0`), **`mandatory`**
(force-update flag), **`changelog`** (shown in the update dialog).

## Ship a change

1. **Promote to `main`** — merge `development → main` via PR (main is protected).
2. **Actions ▸ Deploy & Release ▸ Run workflow**, tick the components you want:
   - **backend** → builds the WAR (JDK 25) → deploys to the Pi (`dbworldctl update`).
   - **frontend** → builds the web bundle → deploys under `/var/www/dbworld` (timestamped release
     folder + `current` symlink; keeps the last 5).
   - **android** → builds the signed APK + `version.json` → publishes GitHub Release `v<version>`.
     The installed app self-updates on next launch (`/api/app/version` → `version.json` → if
     `versionCode` > installed, downloads `/api/app/download` → 302 → GitHub APK).
   - Tick all three to ship everything in one run.
3. *(Optional)* Run **Build** first to sanity-check the artifacts (or grab a debug APK) without
   shipping anything.

## Versioning (the release number)
- **`versionName`** (human, e.g. `3.1.0`) — the **`version`** input on *Deploy & Release ▸ Android*.
  Leave it blank → **auto-bumps the patch** of the latest published release (`3.1.0 → 3.1.1`).
- **`versionCode`** (Android's internal upgrade counter — must always increase) — auto: a monotonic
  **UTC timestamp `yymmddHHmm`**. No manual bumping; never collides.
- The Release is tagged **`v<versionName>`** and carries the APK + a `version.json`
  (`versionCode` / `versionName` / `apkUrl` / `mandatory` / `changelog`) — the source the in-app
  updater reads.
- The APK is signed with the `ANDROID_*` keystore secrets. It **must be the same keystore** that
  signed installed apps, or Android refuses the update.

## Build or ship a *specific* version
Set the **`ref`** input to a tag/SHA (e.g. `v3.0.3`) on **Build** or **Deploy & Release**. The
workflow *logic* always comes from the default branch, but the *code it checks out* is your `ref` —
so you build old code with the current pipeline. For an Android republish, also set `version`.

## Rollback
- **Backend / Frontend** — *Deploy & Release* with the component ticked + **`ref` = the last-good
  tag/SHA** → rebuilds and redeploys that version.
- **Frontend, instantly (no rebuild)** — the Pi keeps the last 5 web releases. Repoint the symlink
  over SSH:
  ```bash
  ln -sfn /var/www/dbworld/releases/<previous-timestamp> /var/www/dbworld/current
  ```
- **Android** — devices that already updated can't be "un-updated"; roll **forward** by publishing a
  higher `version` with the fix. (You can also delete/mark the bad GitHub Release so new installs
  don't pick it up.)

## Why CI runs on the PR *and* again after merge
- **On the PR** (`pull_request`) — the **gate**: it validates the *merge result* and blocks a red PR
  from landing.
- **On push to `main`** (post-merge) — confirms `main` is actually green after the merge applied;
  catches drift when `main` advanced between the PR check and the merge (another PR landed in the
  gap). It's intentional belt-and-suspenders. If you'd rather have a single run, drop the
  `push: [main]` trigger in `ci.yml` and rely on the PR check.

## Prerequisites (one-time)
- **Secrets** (repo → Settings → Secrets → Actions): `FRONTEND_ENV_PRODUCTION` (web env incl.
  `VITE_FIREBASE_*`), `GOOGLE_SERVICES_JSON_BASE64` (Android FCM config), `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- **Self-hosted runner** on the Pi, running as a service; its user has NOPASSWD sudo for
  `/usr/local/bin/dbworldctl`, write access to `/var/www/dbworld`, and `curl` + `unzip`.
- A **`production`** Environment (optionally with a required reviewer) gates the Pi deploy jobs.
- The Pi needs outbound access to `github.com` / `api.github.com`.

## Relationship to Jenkins
This overlaps the Jenkins pipeline (`db-world-config/server_config/Jenkinsfile`). Use **one** deploy
path — the GitHub Actions flow here — not both.
