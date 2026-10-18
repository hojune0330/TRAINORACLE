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
await mkdir(path.join(output, 'pets'), { recursive: true })
const entries = []
for (const asset of spec.assets) {
  const source = path.join(here, 'sources', `${asset.id}.png`)
  try { await stat(source) } catch { await copyFile(asset.source, source) }
  if (asset.id === 'lineup') continue
  const pet = !['room', 'actions'].includes(asset.id)
  const relative = pet ? `pets/${asset.id}.webp` : `${asset.id}.webp`
  const sourceMeta = await sharp(source).metadata()
  if (pet && (sourceMeta.width !== 1536 || sourceMeta.height !== 1024 || !sourceMeta.hasAlpha)) throw Error(`Wrong sheet format: ${asset.id}`)
  // Delivery encoding only. Preserve the generated art, layout and alpha without masking or repainting.
  const bytes = await sharp(source).webp({ quality: 86, alphaQuality: 100, effort: 6 }).toBuffer()
  await writeFile(path.join(output, relative), bytes)
  entries.push({ id: asset.id, file: relative, width: sourceMeta.width, height: sourceMeta.height,
    alpha: sourceMeta.hasAlpha, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    ...(pet ? { grid: [3, 2], cell: [512, 512], poses: ['awake', 'happy', 'eating', 'playing', 'sleeping', 'waking'] } : {}) })
}
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ version: 1, generatedAt: spec.generatedAt, tool: spec.tool, assets: entries }, null, 2) + '\n')
console.log(JSON.stringify({ files: entries.length, bytes: entries.reduce((sum, item) => sum + item.bytes, 0), assets: entries.map(({ id, bytes }) => ({ id, bytes })) }, null, 2))
