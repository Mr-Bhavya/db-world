# GitHub Actions Workflows

| Workflow | Purpose |
|----------|---------|
| [ci.yml](ci.yml) | Frontend lint, release-order checks and backend compilation on PRs, pushes to main, or manual runs |
| [build.yml](build.yml) | Manually build selected WAR, web bundle or debug APK artifacts; never deploy or publish |
| [deploy.yml](deploy.yml) | Manually build and deploy selected components, then publish the signed Android release after selected deployments succeed |
| [backend-image.yml](backend-image.yml) | Check/build the arm64 backend image; reusable by Deploy & Release for GHCR publication |
| [infra-images.yml](infra-images.yml) | Infrastructure container image builds |
| [sonar.yml](sonar.yml) | Sonar analysis |

See [Releasing & Deploying DB World](../../docs/RELEASING.md) for rollout, rollback and setup instructions.

## Deploy & Release

Select any combination of backend, frontend and Android. The workflow resolves the selected ref
to a commit once and uses that revision across all components. Backend defaults to Docker; the WAR
runtime is available for a Pi that still uses the legacy systemd service.

The production web bundle is built only once when frontend or Android is selected. Web deployment
and Capacitor use the same artifact. Android compilation can run in parallel with backend
deployment, but it does not publish to GitHub Releases until every selected deployment succeeds.

Frontend deployment waits for a selected backend deployment. The final Android publish job waits
for its APK artifact, selected backend deployment and selected frontend deployment. Failed,
cancelled or unexpectedly skipped prerequisites block publication. Only the publishing job has
`contents: write`; it also uses the production environment approval gate.

Android-only releases intentionally do not redeploy the backend. Select backend and Android in
the same run when the new APK requires a new API. This workflow does not coordinate unrelated
deployment runs started through another workflow or Jenkins.

## Setup

- Configure the self-hosted Pi runner and the `production` environment.
- Permit the runner to use the established `dbworld-compose deploy app` and `dbworldctl` commands.
  These commands must wait for health checks and return a nonzero exit status on failed rollout.
- Set `FRONTEND_ENV_PRODUCTION` for production web/Android builds.
- Configure `GOOGLE_SERVICES_JSON_BASE64` and the existing Android signing secrets for releases.
- Keep using one production deployment path, Actions or Jenkins, rather than deploying from both.

Secrets remain in GitHub Actions settings, never in the repository or published artifacts.

## Local Release-Order Check

After installing frontend dependencies, run:

```bash
node scripts/ci/check-release-workflow.cjs
```

This uses the YAML parser already installed with the frontend lint toolchain. It checks the job
dependency graph, runtime/component selection cases, failures, cancellation, source pinning,
single web-bundle build and publication permissions. CI runs the same check.