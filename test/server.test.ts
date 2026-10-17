import { describe, expect, it } from "vitest"
import { buildApp } from "../src/server.js"

describe("server", () => {
  it("GET /health/live returns ok", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/health/live" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: "ok" })
  })

  it("GET /health is an alias of /health/live", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/health" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: "ok" })
  })

  it("GET /health/ready returns ok, then 503 once shutdown has begun", async () => {
    const app = buildApp()
    const ready = await app.inject({ method: "GET", url: "/health/ready" })
    expect(ready.statusCode).toBe(200)
    expect(ready.json()).toEqual({ status: "ok" })

    app.startShutdown()
    const notReady = await app.inject({ method: "GET", url: "/health/ready" })
    expect(notReady.statusCode).toBe(503)
    expect(notReady.json()).toEqual({ status: "shutting_down" })
  })

  it("GET /api/hello returns a message", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/api/hello" })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty("message")
  })

  it("GET /openapi.json returns the spec with the hello route", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/openapi.json" })
    expect(res.statusCode).toBe(200)
    const spec = res.json()
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.paths).toHaveProperty("/api/hello")
    expect(spec.paths).toHaveProperty("/health/live")
    expect(spec.paths).toHaveProperty("/health/ready")
  })

  it("GET /docs serves the Swagger UI", async () => {
    const res = await buildApp().inject({ method: "GET", url: "/docs" })
    expect(res.statusCode).toBe(200)
    expect(res.headers["content-type"]).toContain("text/html")
  })
})
