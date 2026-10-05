import { fileURLToPath } from "node:url"
import { createServer } from "vite"

const port = Number(process.env.PLAYWRIGHT_PORT ?? "4173")
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error("Invalid fixture port")

// Never read .env files or publish test fixtures. App and fixtures are served by
// one Vite module graph, preserving account-scope and other singleton state.
const server = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  envFile: false,
  configLoader: "runner",
  cacheDir: "test-results/browser-fixtures-vite-cache",
  server: { host: "127.0.0.1", port, strictPort: true, allowedHosts: ["127.0.0.1"] },
  clearScreen: false,
})
let closing = false
async function close() {
  if (closing) return
  closing = true
  try { await server.close() }
  catch { process.exitCode = 1 }
}
process.once("SIGINT", close)
process.once("SIGTERM", close)
try { await server.listen() }
catch (error) { await close(); throw error }
