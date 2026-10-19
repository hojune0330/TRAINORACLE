import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const here = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(await readFile(path.resolve(here, '../../app/public/games/pet-friends-v2/manifest.json'), 'utf8'))
const panels = []
await mkdir(path.join(here, 'qa'), { recursive: true })
for (let start = 0; start < manifest.assets.length; start += 6) {
  const group = manifest.assets.slice(start, start + 6)
  const layers = []
  for (let index = 0; index < group.length; index++) {
    const asset = group[index]
    const x = 24 + (index % 2) * 408
    const y = 24 + Math.floor(index / 2) * 300
    const sheet = await sharp(path.join(here, 'sources', `${asset.id}.png`)).resize(384, 256).flatten({ background: '#fffdf7' }).png().toBuffer()
    layers.push({ input: sheet, left: x, top: y + 24 })
    const title = Buffer.from(`<svg width="384" height="24"><text x="0" y="18" font-family="sans-serif" font-size="17" fill="#3f2d22">${asset.id}</text></svg>`)
    layers.push({ input: title, left: x, top: y })
  }
  const file = `contact-${String(Math.floor(start / 6) + 1).padStart(2, '0')}.jpg`
  await sharp({ create: { width: 840, height: 924, channels: 3, background: '#fffdf7' } }).composite(layers).jpeg({ quality: 90 }).toFile(path.join(here, 'qa', file))
  panels.push({ file, ids: group.map(asset => asset.id) })
}
await writeFile(path.join(here, 'qa', 'contact-index.json'), JSON.stringify({ assets: manifest.assets.length, panels }, null, 2) + '\n')
console.log(JSON.stringify({ assets: manifest.assets.length, panels }, null, 2))
