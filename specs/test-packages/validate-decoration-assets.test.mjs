import assert from "node:assert/strict"
import { readFile, readdir, stat } from "node:fs/promises"
import { test } from "node:test"

const assetDirectory = new URL("../../app/public/decorations/", import.meta.url)
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

  assert.equal(files.length, 35)
  assert.ok(files.reduce((total, file) => total + file.size, 0) <= 2 * 1024 * 1024)
})
