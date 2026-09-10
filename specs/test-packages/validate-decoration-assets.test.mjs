import assert from "node:assert/strict"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import { DECORATION_COLLECTIONS, LICENSES } from "../../app/src/domain/decoration-collections.ts"
import { publicDirectory, validateDecorationAssets } from "./validate-decoration-assets.mjs"

async function withFixture(run) {
  const root = await mkdtemp(join(import.meta.dirname, ".decoration-assets-"))
  try {
    for (const directory of ["decorations", "collections", "licenses"]) {
      await cp(join(publicDirectory, directory), join(root, directory), { recursive: true })
    }
    const collections = structuredClone(DECORATION_COLLECTIONS)
    const licenses = structuredClone(LICENSES)
    const manifestPath = join(root, collections[0].assetDir, "assets.json")
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    await run({ root, collections, licenses, manifest, manifestPath })
  } finally {
    // Only this invocation's mkdtemp child is removed, never the source assets.
    await rm(root, { recursive: true, force: true })
  }
}

test("base and registered collection assets are complete, licensed, hash-pinned and lightweight", async () => {
  const result = await validateDecorationAssets()
  assert.equal(result.baseAssets, 35)
  assert.equal(result.collectionAssets, DECORATION_COLLECTIONS.reduce((count, collection) => count + collection.items.length, 0))
})

test("an unmodified on-disk fixture passes the same validator", async () => {
  await withFixture(async ({ root, collections, licenses }) => {
    assert.deepEqual(await validateDecorationAssets(root, { collections, licenses }), await validateDecorationAssets())
  })
})

function mutationTest(name, mutate, expectedError) {
  test(`${name} fails closed`, async () => {
    await withFixture(async (fixture) => {
      const before = JSON.stringify(fixture.manifest)
      await mutate(fixture)
      if (JSON.stringify(fixture.manifest) !== before) {
        await writeFile(fixture.manifestPath, JSON.stringify(fixture.manifest))
      }
      await assert.rejects(validateDecorationAssets(fixture.root, fixture), expectedError)
    })
  })
}

mutationTest("missing registered manifest", ({ manifestPath }) => rm(manifestPath), /ENOENT.*assets\.json/u)
mutationTest("missing entire registered collection", ({ root, collections }) => rm(join(root, collections[0].assetDir), { recursive: true }), /ENOENT.*assets\.json/u)

for (const license of LICENSES.filter((entry) => entry.kind === "OPEN")) {
  mutationTest(`missing ${license.id} license copy`, ({ root }) => rm(join(root, license.licenseFile)), /ENOENT.*(?:LICENSE|MIT)/u)
  mutationTest(`empty ${license.id} license copy`, ({ root }) => writeFile(join(root, license.licenseFile), ""), /license copy must be present/u)
}

mutationTest("missing manifest license record", ({ manifest }) => { delete manifest.licenses[manifest.assets[0].licenseId] }, /manifest must match registry/u)
mutationTest("missing licenseFile in registry and manifest", ({ licenses, manifest }) => {
  const id = manifest.assets[0].licenseId
  delete licenses.find((license) => license.id === id).licenseFile
  delete manifest.licenses[id].licenseFile
}, /licenseFile must be present/u)
mutationTest("unpinned source revision in registry and manifest", ({ licenses, manifest }) => {
  const id = manifest.assets[0].licenseId
  licenses.find((license) => license.id === id).revision = "main"
  manifest.licenses[id].revision = "main"
}, /must pin a source revision/u)
mutationTest("missing source provenance in registry and manifest", ({ collections, manifest }) => {
  delete collections[0].items[0].sourceAsset
  delete manifest.assets[0].sourceAsset
}, /sourceAsset must be present/u)
mutationTest("unknown manifest license", ({ manifest }) => { manifest.assets[0].licenseId = "UNKNOWN" }, /unknown licenseId/u)
mutationTest("unknown registry license", ({ collections }) => { collections[0].items[0].licenseId = "UNKNOWN" }, /unknown licenseId/u)
mutationTest("missing manifest hash", ({ manifest }) => { delete manifest.assets[0].sha256 }, /manifest sha256 must be present and valid/u)
mutationTest("missing registry and manifest hash", ({ collections, manifest }) => {
  delete collections[0].items[0].sha256
  delete manifest.assets[0].sha256
}, /registry sha256 must be present and valid/u)
mutationTest("malformed manifest hash", ({ manifest }) => { manifest.assets[0].sha256 = "not-a-sha256" }, /manifest sha256 must be present and valid/u)
mutationTest("changed manifest hash", ({ manifest }) => { manifest.assets[0].sha256 = "0".repeat(64) }, /manifest must match registry/u)
mutationTest("matching but incorrect registry and manifest hashes", ({ collections, manifest }) => {
  collections[0].items[0].sha256 = "0".repeat(64)
  manifest.assets[0].sha256 = "0".repeat(64)
}, /hash must match the manifest and registry/u)
mutationTest("tampered asset bytes", async ({ root, collections }) => {
  const path = join(root, collections[0].assetDir, collections[0].items[0].fileName)
  const bytes = await readFile(path)
  bytes[bytes.length - 1] ^= 1
  await writeFile(path, bytes)
}, /hash must match the manifest and registry/u)
mutationTest("missing collection asset", ({ root, collections }) => rm(join(root, collections[0].assetDir, collections[0].items[0].fileName)), /asset set must match exactly/u)
mutationTest("unknown collection asset", ({ root, collections }) => writeFile(join(root, collections[0].assetDir, "unknown.webp"), "unknown"), /asset set must match exactly/u)
mutationTest("unknown base asset", ({ root }) => writeFile(join(root, "decorations", "unknown.webp"), "unknown"), /asset set must match exactly/u)
mutationTest("unknown collection directory", ({ root }) => mkdir(join(root, "collections", "unknown")), /collection directory set must match registry exactly/u)
mutationTest("unregistered manifest asset", ({ manifest }) => { manifest.assets.push({ ...manifest.assets[0], catalogId: "UNKNOWN", file: "unknown.webp" }) }, /manifest must match registry/u)
mutationTest("duplicate manifest asset", ({ manifest }) => { manifest.assets.push({ ...manifest.assets[0] }) }, /manifest catalog IDs must be unique/u)
mutationTest("missing manifest asset", ({ manifest }) => { manifest.assets.pop() }, /manifest must match registry/u)
mutationTest("stale manifest acquisition cost", ({ manifest }) => { manifest.assets[0].pointCost += 1 }, /manifest must match registry/u)
mutationTest("unsafe registry asset path", ({ collections }) => { collections[0].items[0].fileName = "../escape.webp" }, /unsafe asset filename/u)
mutationTest("invalid base WebP header", ({ root }) => writeFile(join(root, "decorations", "ink-navy.webp"), "not WebP"), /must be RIFF WebP/u)
mutationTest("changed base asset dimensions", async ({ root }) => {
  const path = join(root, "decorations", "ink-navy.webp")
  const bytes = await readFile(path)
  const chunk = bytes.toString("ascii", 12, 16)
  assert.ok(["VP8X", "VP8 "].includes(chunk))
  bytes[chunk === "VP8X" ? 24 : 26] ^= 1
  await writeFile(path, bytes)
}, /dimensions must stay stable/u)
mutationTest("oversized base asset", async ({ root }) => {
  const path = join(root, "decorations", "ink-navy.webp")
  await writeFile(path, Buffer.concat([await readFile(path), Buffer.alloc(120 * 1024)]))
}, /must stay at or below 120KB/u)
mutationTest("oversized aggregate with individually allowed base assets", async ({ root }) => {
  for (const file of await readdir(join(root, "decorations"))) {
    const path = join(root, "decorations", file)
    const bytes = await readFile(path)
    await writeFile(path, Buffer.concat([bytes, Buffer.alloc(120 * 1024 - bytes.length)]))
  }
}, /must stay at or below 2MB total/u)

test("retired collections retain mandatory manifests, licensing and assets", async () => {
  await withFixture(async ({ root, collections, licenses, manifest, manifestPath }) => {
    collections[0].availability = "RETIRED"
    manifest.availability = "RETIRED"
    await writeFile(manifestPath, JSON.stringify(manifest))
    await validateDecorationAssets(root, { collections, licenses })
    await rm(manifestPath)
    await assert.rejects(validateDecorationAssets(root, { collections, licenses }), /ENOENT.*assets\.json/u)
  })
})
