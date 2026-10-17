import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import Fastify, { type FastifyInstance } from "fastify"

declare module "fastify" {
  interface FastifyInstance {
    /** Flips GET /health/ready to 503 so Kubernetes stops routing traffic before the server closes. */
    startShutdown(): void
  }
}

const statusSchema = {
  type: "object",
  properties: { status: { type: "string" } },
  required: ["status"]
} as const

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" })

  let shuttingDown = false
  app.decorate("startShutdown", () => {
    shuttingDown = true
  })

  app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: { title: "%serviceSlug%", version: "0.0.0" }
    }
  })
  app.register(swaggerUi, { routePrefix: "/docs", uiConfig: { url: "/openapi.json" } })

  // Routes live in a plugin registered after @fastify/swagger so they appear in the spec
  app.register(async instance => {
    instance.get("/openapi.json", { schema: { hide: true } }, async () => instance.swagger())

    const live = {
      schema: { tags: ["health"], summary: "Liveness probe: the process is up", response: { 200: statusSchema } }
    }
    instance.get("/health/live", live, async () => ({ status: "ok" }))
    // Alias of /health/live kept for compatibility
    instance.get("/health", { schema: { ...live.schema, hide: true } }, async () => ({ status: "ok" }))

    instance.get(
      "/health/ready",
      {
        schema: {
          tags: ["health"],
          summary: "Readiness probe: 503 once shutdown has begun",
          response: { 200: statusSchema, 503: statusSchema }
        }
      },
      async (_req, reply) => (shuttingDown ? reply.code(503).send({ status: "shutting_down" }) : { status: "ok" })
    )

    instance.get(
      "/api/hello",
      {
        schema: {
          tags: ["hello"],
          summary: "Example endpoint",
          response: {
            200: { type: "object", properties: { message: { type: "string" } }, required: ["message"] }
          }
        }
      },
      async () => ({ message: "Hello from %serviceSlug%" })
    )
  })

  return app
}
