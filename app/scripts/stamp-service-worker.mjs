import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// Vite's entry HTML contains content-hashed entry/CSS imports. A changed app
// therefore changes the worker bytes even when its caching policy is unchanged.
// Never stamp a timestamp: rebuilding an identical app must not cause a reload.
export async function stampServiceWorker(dist = 'dist') {
  const html = await readFile(resolve(dist, 'index.html'))
  const workerPath = resolve(dist, 'sw.js')
  const worker = (await readFile(workerPath, 'utf8')).replace(/\n\/\/ App release: [a-f0-9]{64}\s*$/u, '').trimEnd()
  const release = createHash('sha256').update(html).digest('hex')
  await writeFile(workerPath, `${worker}\n// App release: ${release}\n`)
  return release
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await stampServiceWorker(process.argv[2] ?? 'dist')
}
