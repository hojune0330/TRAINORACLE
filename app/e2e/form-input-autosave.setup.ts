import { fileURLToPath } from "node:url"
import { createServer } from "vite"

export default async function setup() {
  const server = await createServer({
    root: fileURLToPath(new URL("..", import.meta.url)), envFile: false,
    define: { "import.meta.env.VITE_FEATURE_ACCOUNT_JOURNAL": JSON.stringify("true"),
      "import.meta.env.VITE_KILL_ACCOUNT_JOURNAL": JSON.stringify("false") },
    server: { host: "127.0.0.1", port: 4396, strictPort: true }, clearScreen: false,
  })
  try { await server.listen() }
  catch (error) { await server.close(); throw error }
  return async () => { await server.close() }
}
