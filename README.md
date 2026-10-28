# %serviceSlug%

Backend service (Node 26 LTS, TypeScript 7, Fastify 5) managed by MFE Orchestrator.

## Endpoints

Port `8080` (override with `PORT`). Docs and probes need no auth.

| Purpose      | Method | Path            |
| ------------ | ------ | --------------- |
| Liveness     | GET    | `/health/live`  |
| Readiness    | GET    | `/health/ready` |
| Docs UI      | GET    | `/docs`         |
| OpenAPI spec | GET    | `/openapi.json` |
| Hello        | GET    | `/api/hello`    |

`GET /health` is kept as an alias of `/health/live`. `/health/ready` returns `503` once shutdown has begun.

## Run locally

```bash
pnpm install
pnpm dev            # http://localhost:8080
curl localhost:8080/health/live
open http://localhost:8080/docs
```

## Configuration

Environment variables only:

| Variable            | Default | Description                                                                  |
| ------------------- | ------- | ---------------------------------------------------------------------------- |
| `PORT`              | `8080`  | HTTP port, the server listens on `0.0.0.0`                                   |
| `SHUTDOWN_DELAY_MS` | `2000`  | On SIGTERM, readiness turns `503` for this long before the server closes     |

Keep `SHUTDOWN_DELAY_MS` below the Kubernetes `terminationGracePeriodSeconds` (30s by default) and the `docker stop` timeout. On Kubernetes you can raise it (e.g. `5000`) so the pod leaves the Service endpoints before connections are closed.

## Test and build

```bash
pnpm test
pnpm build && pnpm start
```

## Docker

```bash
docker build -t %serviceSlug% .
docker run --rm -p 8080:8080 %serviceSlug%
```

The image runs as the non-root `node` user (UID 1000) and its `HEALTHCHECK` calls `/health/live`.

Kubernetes probes:

```yaml
livenessProbe:
  httpGet: { path: /health/live, port: 8080 }
readinessProbe:
  httpGet: { path: /health/ready, port: 8080 }
```

## Dependency updates

`.github/dependabot.yml` opens weekly pull requests for the npm packages, the Docker base image and the GitHub Actions, with minor and patch updates grouped into one PR per ecosystem. Majors of `@types/node` and of the `node` base image are ignored: move to the next Node LTS on purpose (Dockerfile, CI `node-version`, `engines`, `@types/node` together). GitLab and Azure DevOps do not read this file: use Renovate there if you need the same.

## Releases

1. Create a new version of the service in the MFE Orchestrator console (this creates a git tag on the repository).
2. The tag triggers CI: tests, image build and push to the container registry, then the image is registered on the console (`POST /api/backends/by-slug/%serviceSlug%/versions/<tag>` with `api-key`).
3. The version shows up in the console with its image reference and digest.

The deploy secret `FLIGHTROOM_API_KEY` is injected in the repository by the console.

- GitHub Actions: `.github/workflows/release.yml` pushes to `ghcr.io/<owner>/<repo>` using `GITHUB_TOKEN`. Optional repo variable `MICROFRONTEND_ORCHESTRATOR_DOMAIN` overrides the console URL.
- GitLab CI: `.gitlab-ci.yml` pushes to the project's container registry.
- Azure DevOps: `azure-pipelines.yml` needs two pipeline variables:
  - `MFE_ORCHESTRATOR_REGISTRY_CONNECTION`: name of the Docker registry service connection;
  - `MFE_ORCHESTRATOR_IMAGE_REPOSITORY`: repository path in the registry (e.g. `my-org/%serviceSlug%`).
  Optionally `MFE_ORCHESTRATOR_REGISTRY_HOST` (e.g. `myregistry.azurecr.io`) so the registered image reference is fully qualified. The digest is not sent from Azure (optional field).

## Deploys

The orchestrator does not deploy the service: your own deploy pipeline does. So that the console can show which version runs in each environment (domain page, deployed versions matrix), have that pipeline report every successful deploy. Set `ENV_SLUG` (the slug of the environment in the console, e.g. `DEV`, `PROD`), `VERSION`, `IMAGE` and `COMMIT_SHA`, with `FLIGHTROOM_API_KEY` holding the deploy secret:

```bash
DOMAIN="${MICROFRONTEND_ORCHESTRATOR_DOMAIN:-%domain%}"
curl -fsS -X POST "${DOMAIN%/}/api/backends/by-slug/%serviceSlug%/environments/${ENV_SLUG}/deployments" \
  -H "api-key: ${FLIGHTROOM_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"version\":\"${VERSION}\",\"image\":\"${IMAGE}\",\"commitSha\":\"${COMMIT_SHA}\"}"
```

- `ENV_SLUG` is matched regardless of case. When two environments of the project differ only by case (e.g. `prod` and `PROD`), use the exact slug: any other spelling is refused with a 409.
- `version` is required (letters, digits, dots, dashes and underscores, at most 128); `image` (at most 512 characters) and `commitSha` (at most 64) are optional. The version does not have to be one the release CI registered.
- The API key needs the MANAGER role, as the deploy secret has. Every report is kept: the latest one is the version shown for that environment.
