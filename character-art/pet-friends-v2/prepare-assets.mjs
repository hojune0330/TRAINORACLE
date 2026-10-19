import { readFile, writeFile, mkdir, copyFile, constants } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const here = path.dirname(fileURLToPath(import.meta.url))
const output = path.resolve(here, '../../app/public/games/pet-friends-v2')
const spec = JSON.parse(await readFile(path.join(here, 'generation.json'), 'utf8'))
const poses = ['awake', 'happy', 'eating', 'playing', 'sleeping', 'waking']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
await mkdir(path.join(here, 'sources'), { recursive: true })
await mkdir(path.join(here, 'qa'), { recursive: true })
await mkdir(path.join(output, 'pets'), { recursive: true })
const entries = []
let previous = []
try { previous = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8')).assets } catch {}
for (const asset of spec.assets) {
  const source = path.join(here, 'sources', `${asset.id}.png`)
  try { await copyFile(asset.source, source, constants.COPYFILE_EXCL) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  const selected = await readFile(asset.source)
  const existing = await readFile(source)
  if (hash(selected) !== hash(existing)) {
    await mkdir(path.join(here, 'sources', 'variants'), { recursive: true })
    await copyFile(source, path.join(here, 'sources', 'variants', `${asset.id}-${hash(existing).slice(0, 12)}.png`))
    await copyFile(asset.source, source)
  }
  const original = await readFile(source)
  const sourceMeta = await sharp(original).metadata()
  if (sourceMeta.width !== 1536 || sourceMeta.height !== 1024 || !sourceMeta.hasAlpha) throw Error(`Wrong sheet format: ${asset.id}`)
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let transparentPixels = 0
  let maxAlpha = 0
  const cells = []
  for (let frame = 0; frame < 6; frame++) {
    const cellX = (frame % 3) * 512
    const cellY = Math.floor(frame / 3) * 512
    let left = 512, top = 512, right = -1, bottom = -1, boundaryPixels = 0, safeBorderPixels = 0
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const alpha = data[((cellY + y) * info.width + cellX + x) * 4 + 3]
      if (alpha === 0) transparentPixels++
      maxAlpha = Math.max(maxAlpha, alpha)
      if (alpha > 8) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
        if (x < 2 || y < 2 || x >= 510 || y >= 510) boundaryPixels++
        if (x < 12 || y < 12 || x >= 500 || y >= 500) safeBorderPixels++
      }
    }
    if (right < left) throw Error(`Empty pose: ${asset.id}/${poses[frame]}`)
    cells.push({ pose: poses[frame], bounds: [left, top, right, bottom], boundaryPixels, safeBorderPixels, minPadding: Math.min(left, top, 511 - right, 511 - bottom) })
  }
  if (!transparentPixels) throw Error(`No actual transparent pixels: ${asset.id}`)
  let encoded, quality = 86
  const relative = `pets/${asset.id}.webp`
  const cached = previous.find(entry => entry.id === asset.id && entry.source?.sha256 === hash(original))
  if (cached) {
    try {
      const candidate = await readFile(path.join(output, relative))
      if (hash(candidate) === cached.sha256) { encoded = candidate; quality = cached.encoding.quality }
    } catch {}
  }
  if (!encoded) for (quality of [86, 80, 74, 68, 62]) {
    encoded = await sharp(original).webp({ quality, alphaQuality: 100, effort: 6 }).toBuffer()
    if (encoded.length <= 150000) break
  }
  if (encoded.length > 200000) throw Error(`Runtime sheet exceeds 200KB: ${asset.id}`)
  await writeFile(path.join(output, relative), encoded)
  await sharp(original).flatten({ background: '#fffdf7' }).jpeg({ quality: 88 }).toFile(path.join(here, 'qa', `${asset.id}-on-ivory.jpg`))
  entries.push({
    id: asset.id, label: asset.label, kind: asset.kind, file: relative, width: sourceMeta.width, height: sourceMeta.height,
    alpha: true, bytes: encoded.length, sha256: hash(encoded), encoding: { format: 'webp', quality, alphaQuality: 100 },
    source: { file: `character-art/pet-friends-v2/sources/${asset.id}.png`, bytes: original.length, sha256: hash(original) },
    grid: [3, 2], cell: [512, 512], poses,
    qa: { transparentPixels, maxAlpha, cellBoundaryClear: cells.every(cell => cell.boundaryPixels === 0), cellPaddingAtLeast12: cells.every(cell => cell.safeBorderPixels === 0), cells }
  })
}
const manifest = { version: 2, generatedAt: spec.generatedAt, tool: spec.tool, assets: entries }
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
const escaped = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const cards = entries.map(entry => `<section><h2>${escaped(entry.label)} <small>${entry.id} · ${entry.bytes.toLocaleString()} B</small></h2><div class="poses">${poses.map((pose, frame) => `<figure><span role="img" aria-label="${escaped(entry.label)} ${pose}" class="sprite" style="background-image:url('pets/${entry.id}.webp');background-position:${(frame % 3) * 50}% ${Math.floor(frame / 3) * 100}%"></span><figcaption>${pose}</figcaption></figure>`).join('')}</div></section>`).join('\n')
await writeFile(path.join(output, 'gallery.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>우리 집 친구들 v2 · 에셋 검수</title><style>body{margin:0;background:#fffdf7;color:#3f2d22;font:16px/1.5 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:20px;margin:0 0 12px}small{font-size:13px;font-weight:400}section{padding:20px 0;border-top:1px solid #dfd6c9}.poses{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}figure{margin:0;min-width:0;text-align:center}.sprite{display:block;width:100%;aspect-ratio:1;background-size:300% 200%;background-repeat:no-repeat}figcaption{font-size:12px}@media(max-width:650px){main{padding:16px}.poses{grid-template-columns:repeat(3,minmax(0,1fr))}small{display:block}}</style><main><h1>우리 집 친구들 · 새 36종 에셋</h1><p>실제 투명 WebP · 3열×2행 · awake → happy → eating → playing → sleeping → waking. 현재 생성 ${entries.length}종.</p>${cards}</main></html>\n`)
console.log(JSON.stringify({ files: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), cellsClear: entries.every(entry => entry.qa.cellBoundaryClear), assets: entries.map(({ id, bytes, qa }) => ({ id, bytes, cellBoundaryClear: qa.cellBoundaryClear })) }, null, 2))
