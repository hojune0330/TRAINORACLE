import { fileURLToPath } from "node:url"
import { createServer } from "vite"

// Keep Vite in the runner process: Windows shell-tree teardown can hang even
// after all tests pass. This owns only the dedicated loopback port, never a UI server.
export default async function setup() {
  const server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { host: "127.0.0.1", port: 4381, strictPort: true },
    clearScreen: false,
  })
  try { await server.listen() }
  catch (error) { await server.close(); throw error }
  return async () => { await server.close() }
}
