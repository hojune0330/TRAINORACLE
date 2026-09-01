import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir, stat } from "node:fs/promises"
import { test } from "node:test"

const assetDirectory = new URL("../../app/public/decorations/", import.meta.url)
const openLicenseManifestUrl = new URL("open-license-assets.json", assetDirectory)
const openLicenseManifest = JSON.parse(await readFile(openLicenseManifestUrl, "utf8"))
const expectedDimensions = new Map([
  ["theme-track-notebook.webp", [512, 512]],
  ["theme-sky-journal.webp", [512, 512]],
  ["theme-grid-field.webp", [512, 512]],
  ["theme-dawn-run.webp", [512, 512]],
  ["theme-forest-trail.webp", [512, 512]],
  ["theme-race-day.webp", [512, 512]],
  ["tape-checker.webp", [512, 128]],
  ["tape-sage-solid.webp", [512, 128]],
  ["tape-diagonal.webp", [512, 128]],
  ["tape-dot-grid.webp", [512, 128]],
  ["tape-track-lane.webp", [512, 128]],
  ["tape-mountain.webp", [512, 128]],
  ["sticker-weather-sun.webp", [256, 256]],
  ["sticker-finish-line.webp", [256, 256]],
  ["sticker-running-shoe.webp", [256, 256]],
  ["sticker-water-bottle.webp", [256, 256]],
  ["sticker-stopwatch-doodle.webp", [256, 256]],
  ["sticker-heart-rate.webp", [256, 256]],
  ["sticker-trail-tree.webp", [256, 256]],
  ["sticker-medal-ribbon.webp", [256, 256]],
  ["sticker-night-moon.webp", [256, 256]],
  ["sticker-bandage-care.webp", [256, 256]],
  ["stamp-rest-day.webp", [256, 256]],
  ["stamp-done-check.webp", [256, 256]],
  ["stamp-personal-best.webp", [256, 256]],
  ["stamp-early-bird.webp", [256, 256]],
  ["stamp-rain-run.webp", [256, 256]],
  ["stamp-long-run.webp", [256, 256]],
  ["stamp-interval.webp", [256, 256]],
  ["stamp-recovery.webp", [256, 256]],
  ["ink-navy.webp", [256, 256]],
  ["avatar-start-line.webp", [256, 256]],
  ["avatar-easy-jog.webp", [256, 256]],
  ["avatar-sprinter.webp", [256, 256]],
  ["avatar-stretching.webp", [256, 256]],
])
for (const asset of openLicenseManifest.assets) expectedDimensions.set(asset.file, [256, 256])
const expectedFiles = [...expectedDimensions.keys()]

function readWebpDimensions(bytes, fileName) {
  const chunk = bytes.subarray(12, 16).toString("ascii")
  if (chunk === "VP8X") {
    return [
      1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    ]
  }
  if (chunk === "VP8 ") {
    assert.equal(bytes.subarray(23, 26).toString("hex"), "9d012a", `${fileName} must contain a valid VP8 frame header`)
    return [bytes[26] | (bytes[27] << 8), bytes[28] | (bytes[29] << 8)]
  }
  throw new Error(`${fileName} has unsupported WebP chunk ${chunk}`)
}

test("expanded decoration assets stay complete, valid, and lightweight", async () => {
  const diskFiles = (await readdir(assetDirectory)).filter((fileName) => fileName.endsWith(".webp")).sort()
  assert.deepEqual(diskFiles, [...expectedFiles].sort(), "asset directory must match the catalog asset set exactly")

  const files = await Promise.all(expectedFiles.map(async (fileName) => {
    const fileUrl = new URL(fileName, assetDirectory)
    const [bytes, metadata] = await Promise.all([readFile(fileUrl), stat(fileUrl)])
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${fileName} must be RIFF WebP`)
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${fileName} must be WebP`)
    assert.ok(metadata.size <= 120 * 1024, `${fileName} must stay at or below 120KB`)
    assert.deepEqual(readWebpDimensions(bytes, fileName), expectedDimensions.get(fileName), `${fileName} dimensions must stay stable`)
    return { fileName, size: metadata.size }
  }))

  assert.equal(files.length, 63)
  assert.ok(files.reduce((total, file) => total + file.size, 0) <= 2 * 1024 * 1024)
})

test("open-license sticker manifest pins provenance, price, license copies, and file hashes", async () => {
  assert.equal(openLicenseManifest.schemaVersion, 1)
  assert.equal(openLicenseManifest.collectionId, "OPEN_CUTE_V1")
  assert.equal(openLicenseManifest.catalogPricePoints, 4)
  assert.deepEqual(openLicenseManifest.render, {
    format: "WebP",
    width: 256,
    height: 256,
    transparentBackground: true,
    quality: 88,
    alphaQuality: 100,
  })
  assert.equal(openLicenseManifest.assets.length, 28)
  assert.equal(new Set(openLicenseManifest.assets.map((asset) => asset.catalogId)).size, 28)
  assert.equal(new Set(openLicenseManifest.assets.map((asset) => asset.file)).size, 28)
  assert.equal(openLicenseManifest.assets.filter((asset) => asset.source === "FLUENT_EMOJI_FLAT_MIT").length, 24)
  assert.equal(openLicenseManifest.assets.filter((asset) => asset.source === "OPEN_PEEPS_CC0").length, 4)

  for (const [sourceId, source] of Object.entries(openLicenseManifest.sources)) {
    assert.match(source.revision, /^[a-f0-9]{40}$/u, `${sourceId} must pin a source revision`)
    const licenseBytes = await readFile(new URL(source.licenseFile, assetDirectory))
    assert.ok(licenseBytes.length > 500, `${sourceId} license copy must be present`)
  }

  for (const asset of openLicenseManifest.assets) {
    assert.ok(openLicenseManifest.sources[asset.source], `${asset.catalogId} must reference a known source`)
    assert.match(asset.file, /^cute-[a-z0-9-]+\.webp$/u)
    assert.match(asset.sha256, /^[a-f0-9]{64}$/u)
    const bytes = await readFile(new URL(asset.file, assetDirectory))
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${asset.file} hash must match the manifest`)
  }
})
