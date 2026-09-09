import { fileURLToPath } from "node:url"
import { createServer } from "vite"

export default async function setup() {
  const server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    cacheDir: "node_modules/.vite-account-plan-mobile",
    envFile: false,
    server: { host: "127.0.0.1", port: 4383, strictPort: true },
    clearScreen: false,
  })
  try { await server.listen() }
  catch (error) { await server.close(); throw error }
  return async () => { await server.close() }
}
