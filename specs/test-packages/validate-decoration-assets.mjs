import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DECORATION_COLLECTIONS,
  LICENSES,
  acquisitionCost,
  collectionItemAcquisition,
} from "../../app/src/domain/decoration-collections.ts"

export const publicDirectory = fileURLToPath(new URL("../../app/public/", import.meta.url))
const expectedDimensions = new Map([
  ["theme-track-notebook.webp", [576, 768]],
  ["theme-sky-journal.webp", [576, 768]],
  ["theme-grid-field.webp", [576, 768]],
  ["theme-dawn-run.webp", [576, 768]],
  ["theme-forest-trail.webp", [576, 768]],
  ["theme-race-day.webp", [576, 768]],
  ["tape-checker.webp", [640, 160]],
  ["tape-sage-solid.webp", [640, 160]],
  ["tape-diagonal.webp", [640, 160]],
  ["tape-dot-grid.webp", [640, 160]],
  ["tape-track-lane.webp", [640, 160]],
  ["tape-mountain.webp", [640, 160]],
  ["sticker-weather-sun.webp", [288, 288]],
  ["sticker-finish-line.webp", [288, 288]],
  ["sticker-running-shoe.webp", [288, 288]],
  ["sticker-water-bottle.webp", [288, 288]],
  ["sticker-stopwatch-doodle.webp", [288, 288]],
  ["sticker-heart-rate.webp", [288, 288]],
  ["sticker-trail-tree.webp", [288, 288]],
  ["sticker-medal-ribbon.webp", [288, 288]],
  ["sticker-night-moon.webp", [288, 288]],
  ["sticker-bandage-care.webp", [288, 288]],
  ["stamp-rest-day.webp", [288, 288]],
  ["stamp-done-check.webp", [288, 288]],
  ["stamp-personal-best.webp", [288, 288]],
  ["stamp-early-bird.webp", [288, 288]],
  ["stamp-rain-run.webp", [288, 288]],
  ["stamp-long-run.webp", [288, 288]],
  ["stamp-interval.webp", [288, 288]],
  ["stamp-recovery.webp", [288, 288]],
  ["ink-navy.webp", [288, 288]],
  ["avatar-start-line.webp", [288, 288]],
  ["avatar-easy-jog.webp", [288, 288]],
  ["avatar-sprinter.webp", [288, 288]],
  ["avatar-stretching.webp", [288, 288]],
])

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

async function exactFiles(directory, expected) {
  const entries = await readdir(directory, { withFileTypes: true })
  assert.ok(entries.every((entry) => entry.isFile()), `${directory}: unknown asset directory or symlink`)
  assert.deepEqual(entries.map((entry) => entry.name).sort(), [...expected].sort(), `${directory}: asset set must match exactly (missing or unknown asset)`)
}

async function validateWebp(root, path, dimensions) {
  const bytes = await readFile(join(root, path))
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${path} must be RIFF WebP`)
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${path} must be WebP`)
  assert.ok(bytes.length <= 120 * 1024, `${path} must stay at or below 120KB`)
  assert.deepEqual(readWebpDimensions(bytes, path), dimensions, `${path} dimensions must stay stable`)
  return bytes
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`)
}

function nonempty(value, label) {
  assert.equal(typeof value, "string", `${label} must be present`)
  assert.ok(value.trim().length > 0, `${label} must be present`)
}

// Read the registry even when a manifest/directory is missing. Disk discovery alone
// would silently drop a deleted collection, including retained/retired assets.
export async function validateDecorationAssets(root = publicDirectory, {
  collections = DECORATION_COLLECTIONS,
  licenses = LICENSES,
} = {}) {
  unique(collections.map((collection) => collection.id), "collection IDs")
  unique(collections.map((collection) => collection.assetDir), "collection directories")
  unique(collections.flatMap((collection) => collection.items.map((item) => item.id)), "catalog IDs")
  unique(licenses.map((license) => license.id), "license IDs")
  for (const collection of collections) {
    assert.match(collection.assetDir, /^collections\/[a-z0-9]+(?:-[a-z0-9]+)*$/u, `${collection.id}: unsafe assetDir`)
    assert.ok(collection.items.length > 0, `${collection.id}: assets must not be empty`)
  }

  await exactFiles(join(root, "decorations"), expectedDimensions.keys())
  let totalBytes = 0
  for (const [file, dimensions] of expectedDimensions) {
    totalBytes += (await validateWebp(root, `decorations/${file}`, dimensions)).length
  }

  for (const collection of collections) {
    const manifestPath = join(root, collection.assetDir, "assets.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    assert.equal(manifest.schemaVersion, 2, `${collection.id}: manifest schemaVersion`)
    assert.ok(Array.isArray(manifest.assets), `${collection.id}: manifest assets must be present`)
    unique(manifest.assets.map((asset) => asset.catalogId), "manifest catalog IDs")
    unique(manifest.assets.map((asset) => asset.file), "manifest asset files")
    unique(collection.items.map((item) => item.fileName), "registry asset files")
    const expectedLicenses = {}
    const expectedAssets = []
    for (const item of collection.items) {
      assert.match(item.fileName, /^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/u, `${item.id}: unsafe asset filename`)
      assert.match(item.sha256 ?? "", /^[a-f0-9]{64}$/u, `${item.id}: registry sha256 must be present and valid`)
      nonempty(item.sourceAsset, `${item.id}: sourceAsset`)
      const license = licenses.find((candidate) => candidate.id === item.licenseId)
      assert.ok(license, `${item.id}: unknown licenseId ${item.licenseId}`)
      expectedLicenses[license.id] = license
      const acquisition = collectionItemAcquisition(collection, item)
      expectedAssets.push({
        catalogId: item.id,
        file: item.fileName,
        licenseId: item.licenseId,
        acquisition,
        pointCost: acquisitionCost(acquisition),
        sourceAsset: item.sourceAsset,
        sha256: item.sha256,
      })
    }

    for (const license of Object.values(expectedLicenses)) {
      nonempty(license.terms, `${license.id}: license terms`)
      assert.ok(["OPEN", "COMMERCIAL", "IN_HOUSE"].includes(license.kind), `${license.id}: unknown license kind`)
      if (license.kind === "OPEN") {
        nonempty(license.licenseFile, `${license.id}: licenseFile`)
        // Current provenance is either a commit, or a pinned package plus commit.
        assert.match(license.revision ?? "", /^(?:[a-f0-9]{40}|[^()\r\n]+ \([a-f0-9]{40}\))$/u, `${license.id}: must pin a source revision`)
        assert.match(license.sourceUrl ?? "", /^https:\/\//u, `${license.id}: source URL must be present`)
      }
      if (license.licenseFile !== undefined) {
        assert.match(license.licenseFile, /^licenses\/[a-zA-Z0-9._-]+$/u, `${license.id}: unsafe licenseFile`)
        const bytes = await readFile(join(root, license.licenseFile))
        assert.ok(bytes.length > 500, `${license.id}: license copy must be present`)
      }
    }

    for (const asset of manifest.assets) {
      assert.match(asset.sha256 ?? "", /^[a-f0-9]{64}$/u, `${asset.catalogId}: manifest sha256 must be present and valid`)
      assert.ok(Object.hasOwn(expectedLicenses, asset.licenseId), `${asset.catalogId}: unknown licenseId ${asset.licenseId}`)
    }
    assert.deepEqual(manifest, {
      schemaVersion: 2,
      generatedBy: "app/scripts/generate-collection-docs.mjs",
      collectionId: collection.id,
      title: collection.title,
      licenseReviewedOn: collection.licenseReviewedOn,
      availability: collection.availability,
      assetDir: collection.assetDir,
      render: collection.render,
      licenses: expectedLicenses,
      assets: expectedAssets,
    }, `${collection.id}: manifest must match registry provenance, licenses, assets, acquisition and hashes exactly`)

    await exactFiles(join(root, collection.assetDir), ["assets.json", ...collection.items.map((item) => item.fileName)])
    for (const asset of manifest.assets) {
      const bytes = await validateWebp(root, `${collection.assetDir}/${asset.file}`, [collection.render.width, collection.render.height])
      assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, `${asset.file}: hash must match the manifest and registry`)
      totalBytes += bytes.length
    }
  }

  const directories = await readdir(join(root, "collections"), { withFileTypes: true })
  assert.ok(directories.every((entry) => entry.isDirectory()), "collections: unknown asset or symlink")
  assert.deepEqual(directories.map((entry) => `collections/${entry.name}`).sort(), collections.map((collection) => collection.assetDir).sort(), "collection directory set must match registry exactly (missing or unknown collection)")
  assert.ok(totalBytes <= 2 * 1024 * 1024, "decoration assets must stay at or below 2MB total")
  return { baseAssets: expectedDimensions.size, collectionAssets: collections.reduce((count, collection) => count + collection.items.length, 0), totalBytes }
}
