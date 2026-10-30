import { createServer } from '../../app/node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../app', import.meta.url))
const server = await createServer({
  root, envFile: false, configLoader: 'runner', clearScreen: false,
  cacheDir: fileURLToPath(new URL('./vite-cache', import.meta.url)),
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_ACCOUNT_PUBLIC_ENABLED': '"false"', 'import.meta.env.VITE_KILL_ACCOUNT': '"true"' },
  server: { host: '127.0.0.1', port: 5183, strictPort: true, hmr: false },
})
await server.listen()
console.log('Synthetic account-OFF flow: http://127.0.0.1:5183/?app=1')
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0) })
