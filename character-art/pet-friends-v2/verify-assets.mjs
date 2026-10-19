import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const output = path.join(repo, 'app/public/games/pet-friends-v2')
const spec = JSON.parse(await readFile(path.join(here, 'generation.json'), 'utf8'))
const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'))
const expected = ['cat','fox','bear-cub','raccoon','squirrel','hamster','ferret','fennec','capybara','koala','panda','sloth','alpaca','lamb','deer','pony','owl','chick','parakeet','bat','frog','axolotl','platypus','beaver','leaf-sprite','cloud-sheep','pebble-sprout','moon-moth','star-mole','rain-blob','acorn-guardian','coral-sprite','snow-sprite','flower-bud','lantern-sprout','moss-turtle']
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const ids = manifest.assets.map(asset => asset.id)
if (ids.length !== 36 || new Set(ids).size !== 36 || expected.some(id => !ids.includes(id))) throw Error('Missing, extra or duplicated manifest IDs')
if (spec.assets.filter(asset => asset.kind === 'animal').length !== 24 || spec.assets.filter(asset => asset.kind === 'dream').length !== 12) throw Error('Wrong animal/dream count')
const actualWebp = (await readdir(path.join(output, 'pets'))).filter(file => file.endsWith('.webp'))
if (actualWebp.length !== 36 || expected.some(id => !actualWebp.includes(`${id}.webp`))) throw Error('Unexpected runtime WebP inventory')
const assets = []
for (const entry of manifest.assets) {
  const source = await readFile(path.join(here, 'sources', `${entry.id}.png`))
  const runtime = await readFile(path.join(output, entry.file))
  const [sourceMeta, runtimeMeta] = await Promise.all([sharp(source).metadata(), sharp(runtime).metadata()])
  if ([sourceMeta, runtimeMeta].some(meta => meta.width !== 1536 || meta.height !== 1024 || !meta.hasAlpha)) throw Error(`Wrong dimensions or missing alpha: ${entry.id}`)
  if (sha256(source) !== entry.source.sha256 || source.length !== entry.source.bytes || sha256(runtime) !== entry.sha256 || runtime.length !== entry.bytes) throw Error(`Hash or bytes mismatch: ${entry.id}`)
  if (runtime.length > 200000) throw Error(`Runtime exceeds 200KB: ${entry.id}`)
  const [sourceAlpha, runtimeAlpha] = await Promise.all([sharp(source).extractChannel('alpha').raw().toBuffer(), sharp(runtime).extractChannel('alpha').raw().toBuffer()])
  let alphaMismatchPixels = 0, boundaryNonzeroPixels = 0, boundaryVisiblePixels = 0, boundaryAlphaMax = 0, transparentPixels = 0
  const cells = []
  for (let frame = 0; frame < 6; frame++) {
    const x0 = (frame % 3) * 512, y0 = Math.floor(frame / 3) * 512
    let left = 512, top = 512, right = -1, bottom = -1
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y0 + y) * 1536 + x0 + x
      const alpha = sourceAlpha[i]
      if (alpha !== runtimeAlpha[i]) alphaMismatchPixels++
      if (!alpha) transparentPixels++
      else {
        if (alpha > 8) {
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
        }
        if (x < 2 || y < 2 || x >= 510 || y >= 510) {
          boundaryNonzeroPixels++
          boundaryAlphaMax = Math.max(boundaryAlphaMax, alpha)
          if (alpha > 8) boundaryVisiblePixels++
        }
      }
    }
    if (right < left) throw Error(`Empty pose: ${entry.id}/${frame}`)
    cells.push({ pose: entry.poses[frame], bounds: [left, top, right, bottom], minPadding: Math.min(left, top, 511-right, 511-bottom) })
  }
  if (alphaMismatchPixels) throw Error(`Alpha changed during WebP encoding: ${entry.id}`)
  if (boundaryVisiblePixels) throw Error(`Visible content crosses cell boundary: ${entry.id}: ${boundaryVisiblePixels} pixels`)
  if (!transparentPixels) throw Error(`No actual transparent background: ${entry.id}`)
  assets.push({ id: entry.id, bytes: runtime.length, sha256: entry.sha256, sourceBytes: source.length, sourceSha256: entry.source.sha256, alphaMismatchPixels, boundaryNonzeroPixels, boundaryVisiblePixels, boundaryAlphaMax, transparentPixels, cells })
}
const largest = assets.reduce((a, b) => a.bytes >= b.bytes ? a : b)
const report = {
  checkedAt: '2026-10-19', outcome: assets.some(entry => entry.boundaryNonzeroPixels) ? 'PASS_WITH_SOURCE_ALPHA_RESIDUE_WARNING' : 'PASS', selectedSheets: 36, stateDrawings: 216, animals: 24, originalDreamCreatures: 12,
  sourcePngBytes: assets.reduce((sum, entry) => sum + entry.sourceBytes, 0), runtimeWebpBytes: assets.reduce((sum, entry) => sum + entry.bytes, 0),
  largest: { id: largest.id, bytes: largest.bytes }, allAtMost150KB: assets.every(entry => entry.bytes <= 150000),
  dimensions: [1536, 1024], grid: [3, 2], cell: [512, 512], alphaPreservedExactly: true,
  allTwoPixelCellBordersFullyTransparent: assets.every(entry => entry.boundaryNonzeroPixels === 0),
  allVisibleCellBordersClear: assets.every(entry => entry.boundaryVisiblePixels === 0), visibleAlphaThreshold: 8,
  sourceBoundaryAlphaResidueMax: Math.max(...assets.map(entry => entry.boundaryAlphaMax)),
  sourceBoundaryAlphaResiduePixels: assets.reduce((sum, entry) => sum + entry.boundaryNonzeroPixels, 0),
  sourceAlphaResidueNote: 'Built-in originals contain isolated alpha 1-3 matte pixels at cell borders. They are preserved exactly; no code masking or repainting was applied. Alpha-zero-only border acceptance is not claimed.',
  tightPaddingWarnings: assets.flatMap(entry => entry.cells.filter(cell => cell.minPadding < 12).map(cell => ({ id: entry.id, pose: cell.pose, minPadding: cell.minPadding }))),
  assets
}
await writeFile(path.join(here, 'qa', 'validation.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ ...report, assets: undefined }, null, 2))
if (process.argv.includes('--inventory')) {
  const files = []
  for (const root of [here, output]) {
    async function walk(folder) {
      for (const dirent of await readdir(folder, { withFileTypes: true })) {
        const full = path.join(folder, dirent.name)
        if (dirent.isDirectory()) await walk(full)
        else if (full !== path.join(here, 'inventory.json')) {
          const data = await readFile(full)
          files.push({ file: path.relative(repo, full).replaceAll('\\', '/'), bytes: data.length, sha256: sha256(data) })
        }
      }
    }
    await walk(root)
  }
  files.sort((a,b) => a.file.localeCompare(b.file))
  await writeFile(path.join(here, 'inventory.json'), JSON.stringify({ generatedAt: '2026-10-19', excluded: ['character-art/pet-friends-v2/inventory.json'], files }, null, 2) + '\n')
  console.log(JSON.stringify({ inventoryFiles: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }, null, 2))
}
