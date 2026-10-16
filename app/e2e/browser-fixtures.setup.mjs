import { fileURLToPath } from "node:url"
import { createServer } from "vite"
import { Worker } from "node:worker_threads"

const port = Number(process.env.PLAYWRIGHT_PORT ?? "4173")
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error("Invalid fixture port")

// Never read .env files or publish test fixtures. App and fixtures are served by
// one Vite module graph, preserving account-scope and other singleton state.
const arena = new Worker(new URL("./arena-fixture-worker.mjs", import.meta.url), { workerData: `http://127.0.0.1:${port}` })
const arenaPort = await new Promise((resolve, reject) => {
  arena.once("message", resolve)
  arena.once("error", reject)
})
let server
try { server = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  envFile: false,
  define: { "import.meta.env.VITE_FRIEND_ARENA_URL": JSON.stringify(`ws://127.0.0.1:${arenaPort}/`) },
  configLoader: "runner",
  cacheDir: "test-results/browser-fixtures-vite-cache",
  server: { host: "127.0.0.1", port, strictPort: true, allowedHosts: ["127.0.0.1"] },
  clearScreen: false,
}) } catch (error) { await arena.terminate(); throw error }
let closing = false
async function close() {
  if (closing) return
  closing = true
  try { await server.close() }
  catch { process.exitCode = 1 }
  finally { await arena.terminate() }
}
process.once("SIGINT", close)
process.once("SIGTERM", close)
try { await server.listen() }
catch (error) { await close(); throw error }
