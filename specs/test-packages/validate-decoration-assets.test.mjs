import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"
import { test } from "node:test"

const assetDirectory = new URL("../../app/public/decorations/", import.meta.url)
const expectedFiles = [
  "avatar-start-line.webp",
  "ink-navy.webp",
  "stamp-rest-day.webp",
  "sticker-finish-line.webp",
  "sticker-weather-sun.webp",
  "tape-checker.webp",
  "theme-sky-journal.webp",
  "theme-track-notebook.webp",
]

const expectedDimensions = new Map([
  ["avatar-start-line.webp", [256, 256]],
  ["ink-navy.webp", [256, 256]],
  ["stamp-rest-day.webp", [256, 256]],
  ["sticker-finish-line.webp", [256, 256]],
  ["sticker-weather-sun.webp", [256, 256]],
  ["tape-checker.webp", [512, 128]],
  ["theme-sky-journal.webp", [512, 512]],
  ["theme-track-notebook.webp", [512, 512]],
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

test("beta decoration assets stay complete, valid, and lightweight", async () => {
  const files = await Promise.all(expectedFiles.map(async (fileName) => {
    const fileUrl = new URL(fileName, assetDirectory)
    const [bytes, metadata] = await Promise.all([readFile(fileUrl), stat(fileUrl)])
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${fileName} must be RIFF WebP`)
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${fileName} must be WebP`)
    assert.ok(metadata.size <= 120 * 1024, `${fileName} must stay at or below 120KB`)
    assert.deepEqual(readWebpDimensions(bytes, fileName), expectedDimensions.get(fileName), `${fileName} dimensions must stay stable`)
    return { fileName, size: metadata.size }
  }))

  assert.equal(files.length, 8)
  assert.ok(files.reduce((total, file) => total + file.size, 0) <= 500 * 1024)
})
