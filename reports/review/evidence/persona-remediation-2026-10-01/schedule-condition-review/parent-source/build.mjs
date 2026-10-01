import { build, preview } from '../../app/node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const root = fileURLToPath(new URL('../../app/', import.meta.url))
const here = fileURLToPath(new URL('./reviewed/', import.meta.url))
mkdirSync(here + 'no-env', { recursive: true })
const config = { root, configFile: root + 'vite.config.ts', envDir: here + 'no-env',
  cacheDir: here + 'cache', build: { outDir: here + 'dist', emptyOutDir: false },
  preview: { host: '127.0.0.1', port: 4428, strictPort: true, allowedHosts: ['127.0.0.1'] } }
await build(config)
writeFileSync(here + 'build-receipt.json', JSON.stringify({ builtAt: new Date().toISOString(),
  synthetic: true, production: false, htmlSha256: createHash('sha256').update(readFileSync(here + 'dist/index.html')).digest('hex'),
}, null, 2), { flag: 'wx' })
const server = await preview(config)
server.printUrls()
