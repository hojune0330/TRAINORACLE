import { describe, expect, it, vi } from "vitest"
import {
  BackupJsonExportLimitError,
  BackupJsonLimitError,
  readBackupJsonBlob,
  stringifyBackupJsonForExport,
} from "./backup-json-stream"
import {
  FULL_FORMAT, FULL_FORMAT_V3, FULL_FORMAT_V4, FULL_FORMAT_V5, LEGACY_FULL_FORMAT,
  SAFE_FORMAT, readBackupBlob, readBackupFile,
} from "./backup-file"

const entry = {
  id: "synthetic-race",
  kind: "race",
  date: "2026-07-14",
  savedAt: "2026-07-14T00:01:00.000Z",
  syncState: "local",
  stage: "post",
  record: "4:08.21",
  rank: "",
  result: "",
  memo: "",
}

function jsonBlob(value: string): Blob {
  return new Blob([new TextEncoder().encode(value)], { type: "application/json" })
}

describe("chunked backup JSON reading", () => {
  it.each([
    SAFE_FORMAT, LEGACY_FULL_FORMAT, FULL_FORMAT, FULL_FORMAT_V3, FULL_FORMAT_V4, FULL_FORMAT_V5,
  ])("keeps the existing %s restore result", async format => {
    const source = JSON.stringify({ app: "TRAINORACLE", format, exportedAt: "2026-07-14T00:00:00.000Z", entries: [entry] })
    expect(await readBackupBlob(jsonBlob(source))).toEqual(readBackupFile(source))
  })

  it("decodes UTF-8 split between bytes and quoted/backslash text across chunks", async () => {
    const source = JSON.stringify({
      entries: [{ ...entry, memo: '이모지 😀, "따옴표", 역슬래시 \\', memoPurpose: "PRIVATE_SELF_ONLY" }],
      ignored: { nested: [true, null, { value: "😀" }] },
      format: FULL_FORMAT_V5,
      app: "TRAINORACLE",
    })
    const root = await readBackupJsonBlob(jsonBlob(" \n" + source + "\t"), () => true, 1)
    expect(root.entries).toEqual(JSON.parse(source).entries)
    expect(root.format).toBe(FULL_FORMAT_V5)
    expect(root).not.toHaveProperty("ignored")
  })

  it("uses the last duplicate top-level property just like JSON.parse", async () => {
    const source = '{"entries":[{"id":"first"}],"app":"TRAINORACLE","format":"'
      + SAFE_FORMAT + '","entries":[' + JSON.stringify(entry) + ']}'
    const result = await readBackupBlob(jsonBlob(source))
    expect(result.recognized).toBe(true)
    expect(result.entries.map(item => item.id)).toEqual([entry.id])
    expect(result).toEqual(readBackupFile(source))
  })

  it.each([
    '[]',
    '{"app":"TRAINORACLE","format":"' + SAFE_FORMAT + '","entries":[]} garbage',
    '{"app":"TRAINORACLE","format":"' + SAFE_FORMAT + '","entries":[],"unknown":[1,]}',
    '{"app":"TRAINORACLE","format":"' + SAFE_FORMAT + '","entries":[,]}',
    '{"app":"TRAINORACLE","format":"' + SAFE_FORMAT + '","entries":[],"x":"\\uZZZZ"}',
  ])("rejects malformed or non-object JSON without guessing", async source => {
    expect((await readBackupBlob(jsonBlob(source))).recognized).toBe(false)
  })

  it("rejects invalid UTF-8 and preserves missing-entries and unknown-format behavior", async () => {
    const invalidUtf8 = new Blob([Uint8Array.from([0x7b, 0xff, 0x7d])])
    expect((await readBackupBlob(invalidUtf8)).recognized).toBe(false)
    const missing = '{"app":"TRAINORACLE","format":"' + SAFE_FORMAT + '"}'
    expect(await readBackupBlob(jsonBlob(missing))).toEqual(readBackupFile(missing))
    const unknown = '{"app":"TRAINORACLE","format":"unknown","entries":[]}'
    expect(await readBackupBlob(jsonBlob(unknown))).toEqual(readBackupFile(unknown))
  })

  it("does not call the whole-file text reader", async () => {
    const source = JSON.stringify({ app: "TRAINORACLE", format: SAFE_FORMAT, entries: [entry] })
    const blob = jsonBlob(source)
    Object.defineProperty(blob, "text", { value: vi.fn(() => Promise.reject(new Error("whole file read"))) })
    expect((await readBackupBlob(blob)).entries).toHaveLength(1)
  })

  it("rejects a selected file before reading when its byte budget is exceeded", async () => {
    const blob = jsonBlob('{"app":"TRAINORACLE"}')
    const error = await readBackupJsonBlob(blob, () => true, 4, {
      blobBytes: blob.size - 1, entries: 10, keptValueChars: 1024,
    }).catch(value => value)

    expect(error).toBeInstanceOf(BackupJsonLimitError)
    expect(error).toMatchObject({ limit: "blobBytes" })
  })

  it("bounds every raw entry before retaining or parsing an unbounded value", async () => {
    const source = JSON.stringify({ app: "TRAINORACLE", format: SAFE_FORMAT, entries: [
      { ...entry, memo: "x".repeat(400) },
    ] })
    const error = await readBackupJsonBlob(jsonBlob(source), () => true, 7, {
      blobBytes: 4096, entries: 10, keptValueChars: 256,
    }).catch(value => value)

    expect(error).toBeInstanceOf(BackupJsonLimitError)
    expect(error).toMatchObject({ limit: "keptValueChars" })
  })

  it("counts invalid and valid entry candidates toward one bounded review", async () => {
    const source = JSON.stringify({ app: "TRAINORACLE", format: SAFE_FORMAT, entries: [
      entry, { id: "invalid" }, { ...entry, id: "third" },
    ] })
    const limits = { blobBytes: 4096, entries: 2, keptValueChars: 2048 }
    const error = await readBackupJsonBlob(jsonBlob(source), () => true, 5, limits).catch(value => value)

    expect(error).toBeInstanceOf(BackupJsonLimitError)
    expect(error).toMatchObject({ limit: "entries" })
  })

  it.each([
    ["FILE_TOO_LARGE", { blobBytes: 1, entries: 10, keptValueChars: 1024 }],
    ["TOO_MANY_ENTRIES", { blobBytes: 4096, entries: 0, keptValueChars: 1024 }],
    ["VALUE_TOO_LARGE", { blobBytes: 4096, entries: 10, keptValueChars: 8 }],
  ] as const)("reports %s separately from malformed JSON", async (readFailure, limits) => {
    const source = JSON.stringify({ app: "TRAINORACLE", format: SAFE_FORMAT, entries: [entry] })
    expect(await readBackupBlob(jsonBlob(source), () => true, limits)).toMatchObject({
      recognized: false, readFailure,
    })
  })

  it("serializes an exact-budget export that the same streaming limits accept", async () => {
    const envelope = {
      app: "TRAINORACLE",
      format: SAFE_FORMAT,
      exportedAt: "2026-07-14T00:00:00.000Z",
      entries: [entry],
    }
    const expected = JSON.stringify(envelope, null, 2)
    const limits = {
      blobBytes: new TextEncoder().encode(expected).byteLength,
      entries: envelope.entries.length,
      keptValueChars: Math.max(
        JSON.stringify(envelope.app).length,
        JSON.stringify(envelope.format).length,
        JSON.stringify(envelope.exportedAt).length,
        ...envelope.entries.map(value => JSON.stringify(value).length),
      ),
    }

    const exported = stringifyBackupJsonForExport(envelope, limits)
    const parsed = await readBackupJsonBlob(jsonBlob(exported), () => true, 7, limits)

    expect(exported).toBe(expected)
    expect(parsed).toMatchObject(envelope)
  })

  it("refuses an export exactly one byte over the import budget", () => {
    const envelope = { app: "TRAINORACLE", format: SAFE_FORMAT, entries: [entry] }
    const bytes = new TextEncoder().encode(JSON.stringify(envelope, null, 2)).byteLength
    const error = (() => {
      try {
        stringifyBackupJsonForExport(envelope, {
          blobBytes: bytes - 1,
          entries: 1,
          keptValueChars: JSON.stringify(entry).length,
        })
        return null
      } catch (value) {
        return value
      }
    })()

    expect(error).toBeInstanceOf(BackupJsonExportLimitError)
    expect(error).toMatchObject({
      code: "BACKUP_EXPORT_EXCEEDS_IMPORT_LIMIT",
      limit: "blobBytes",
    })
  })

  it.each([
    ["entries", { blobBytes: 4096, entries: 0, keptValueChars: 2048 }],
    ["keptValueChars", { blobBytes: 4096, entries: 1, keptValueChars: 8 }],
  ] as const)("fails export preflight on the %s budget", (limit, limits) => {
    const error = (() => {
      try {
        stringifyBackupJsonForExport({ app: "TRAINORACLE", format: SAFE_FORMAT, entries: [entry] }, limits)
        return null
      } catch (value) {
        return value
      }
    })()

    expect(error).toBeInstanceOf(BackupJsonExportLimitError)
    expect(error).toMatchObject({ code: "BACKUP_EXPORT_EXCEEDS_IMPORT_LIMIT", limit })
  })
})
