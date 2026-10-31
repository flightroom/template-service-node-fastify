// Preloaded with "node --import" (start script, Dockerfile) so the OpenTelemetry hooks are registered before fastify
// and node:http are loaded. Azure Monitor (Application Insights) is set up only when a connection string is given:
// without it this module does nothing.
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  await import("@azure/monitor-opentelemetry/loader")
  const { useAzureMonitor } = await import("@azure/monitor-opentelemetry")
  // Reads the connection string, OTEL_SERVICE_NAME (cloud role name) and OTEL_RESOURCE_ATTRIBUTES from the environment
  useAzureMonitor()
}

export {}
