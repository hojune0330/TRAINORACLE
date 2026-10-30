import { build } from '../../app/node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'
await build({
  root: fileURLToPath(new URL('../../app', import.meta.url)), envFile: false, configLoader: 'runner',
  cacheDir: fileURLToPath(new URL('./vite-cache', import.meta.url)),
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_ACCOUNT_PUBLIC_ENABLED': '"false"', 'import.meta.env.VITE_KILL_ACCOUNT': '"true"' },
  build: { outDir: fileURLToPath(new URL('./build', import.meta.url)), emptyOutDir: false },
})
