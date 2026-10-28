# AGENTS.md - %serviceSlug%

Node 26 LTS + TypeScript 7 + Fastify 5 backend service, packaged as a Docker image.

## Layout

- `src/server.ts`: `buildApp()` creates the Fastify instance, registers `@fastify/swagger` + `@fastify/swagger-ui` and the routes (exported for tests).
- `src/index.ts`: reads `PORT` and `SHUTDOWN_DELAY_MS`, listens on `0.0.0.0`, handles SIGTERM/SIGINT graceful shutdown.
- `test/*.test.ts`: vitest tests using `app.inject()`.
- `Dockerfile`: multi-stage, non-root, healthcheck on `/health/live`.

## Endpoints the platform relies on

- `GET /health/live`: liveness, `{"status":"ok"}` while the process is up (`GET /health` is an alias).
- `GET /health/ready`: readiness, `200` when ready, `503` once shutdown has begun.
- `GET /docs`: Swagger UI. `GET /openapi.json`: OpenAPI spec. Both public, no auth.

## Add an endpoint

Register the route inside the routes plugin in `src/server.ts` (the one registered after `@fastify/swagger`, otherwise the route is missing from the spec). Give it a `schema` with `tags`, `summary` and a `response` schema per status code, so `/openapi.json` documents it and the response is serialized against it. Then add a test in `test/` that calls it with `buildApp().inject(...)`.

## Add a readiness condition

Readiness is computed in the `/health/ready` handler. To make it depend on a dependency (database, queue), check it there and return `503` when it is unavailable. Do not put dependency checks in `/health/live`: a failing liveness probe restarts the pod.

## Commands

- `pnpm install`, `pnpm test`, `pnpm build`, `pnpm dev`

## Conventions

- ESM with `.js` suffix in relative imports (NodeNext).
- Configuration comes from environment variables only. Never hardcode secrets or URLs.
- Keep the probes, `/docs` and `/openapi.json` working and unauthenticated: Kubernetes, the Docker healthcheck and the platform rely on them.
- Listen on `PORT` (default 8080), host `0.0.0.0`.
- Every new endpoint needs a test. Run `pnpm test` and `pnpm build` before finishing.
- Never edit CI files (`.github/`, `.gitlab-ci.yml`, `azure-pipelines.yml`) or Dockerfile base images unless explicitly asked.
- Dependencies are kept current by Dependabot (`.github/dependabot.yml`, weekly, minor/patch grouped). Add new dependencies at their latest stable version; do not pin old versions without a reason.
