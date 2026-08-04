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

test("beta decoration assets stay complete, valid, and lightweight", async () => {
  const files = await Promise.all(expectedFiles.map(async (fileName) => {
    const fileUrl = new URL(fileName, assetDirectory)
    const [bytes, metadata] = await Promise.all([readFile(fileUrl), stat(fileUrl)])
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${fileName} must be RIFF WebP`)
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${fileName} must be WebP`)
    assert.ok(metadata.size <= 120 * 1024, `${fileName} must stay at or below 120KB`)
    return { fileName, size: metadata.size }
  }))

  assert.equal(files.length, 8)
  assert.ok(files.reduce((total, file) => total + file.size, 0) <= 500 * 1024)
})
