import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const here = path.dirname(fileURLToPath(import.meta.url))
const output = path.resolve(here, '../../app/public/games/pet-room-v1')
const spec = JSON.parse(await readFile(path.join(here, 'generation.json'), 'utf8'))
await mkdir(path.join(here, 'sources'), { recursive: true })
const entries = []
for (const item of spec.assets) {
  const source = path.join(here, 'sources', item.id + '.png')
  try { await stat(source) } catch { await copyFile(item.source, source) }
  const meta = await sharp(source).metadata()
  if (item.grid && (!meta.hasAlpha || meta.width / meta.height !== 1.5)) throw Error('Invalid transparent atlas: ' + item.id)
  if (!item.grid && meta.width !== meta.height) throw Error('Invalid room: ' + item.id)
  // Encoding only: keep original pixels, layout and alpha. No generated art is repainted.
  const bytes = await sharp(source).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toBuffer()
  const file = item.id + '.webp'
  await writeFile(path.join(output, file), bytes)
  entries.push({ id: item.id, file, width: meta.width, height: meta.height, alpha: meta.hasAlpha, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), ...(item.grid ? { grid: item.grid, props: item.props } : {}) })
}
await writeFile(path.join(output, 'care-manifest-v2.json'), JSON.stringify({ version: 2, generatedAt: spec.generatedAt, tool: spec.tool, assets: entries }, null, 2) + '\n')
console.log(JSON.stringify(entries, null, 2))
