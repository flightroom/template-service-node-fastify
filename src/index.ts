import { buildApp } from "./server.js"

const port = Number(process.env.PORT ?? 8080)
// Time between readiness turning 503 and the server closing, so Kubernetes removes the pod from its endpoints first
const shutdownDelayMs = Number(process.env.SHUTDOWN_DELAY_MS ?? 2000)
const app = buildApp()

let shuttingDown = false
const shutdown = async (signal: string) => {
  if (shuttingDown) return
  shuttingDown = true
  app.log.info(`${signal} received, shutting down in ${shutdownDelayMs}ms`)
  app.startShutdown()
  await new Promise(resolve => setTimeout(resolve, shutdownDelayMs))
  await app.close()
  process.exit(0)
}
process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))

app.listen({ port, host: "0.0.0.0" }).catch(err => {
  app.log.error(err)
  process.exit(1)
})
