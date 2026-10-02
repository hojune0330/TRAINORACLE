// Parse a user-selected backup without retaining its entire source JSON string.
// The result still holds the records needed for the restore review.
const DEFAULT_CHUNK_BYTES = 128 * 1024
const MAX_JSON_DEPTH = 256

async function readChunk(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer()
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error("BACKUP_READ_FAILED"))
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else reject(new Error("BACKUP_READ_FAILED"))
    }
    reader.readAsArrayBuffer(blob)
  })
}

class JsonBlobCursor {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true })
  private byteOffset = 0
  private text = ""
  private index = 0
  private ended = false

  constructor(
    private readonly blob: Blob,
    private readonly current: () => boolean,
    private readonly chunkBytes: number,
  ) {}

  async peek(): Promise<string | null> {
    while (this.index >= this.text.length) {
      if (this.ended) return null
      if (!this.current()) throw new Error("BACKUP_READ_CANCELLED")
      if (this.byteOffset >= this.blob.size) {
        this.text = this.decoder.decode()
        this.ended = true
      } else {
        const end = Math.min(this.blob.size, this.byteOffset + this.chunkBytes)
        const bytes = await readChunk(this.blob.slice(this.byteOffset, end))
        this.byteOffset = end
        this.text = this.decoder.decode(new Uint8Array(bytes), { stream: true })
      }
      this.index = 0
    }
    return this.text[this.index] ?? null
  }

  async take(): Promise<string | null> {
    const value = await this.peek()
    if (value !== null) this.index += 1
    return value
  }

  async expect(expected: string): Promise<void> {
    if (await this.take() !== expected) throw new Error("INVALID_BACKUP_JSON")
  }

  async whitespace(): Promise<void> {
    while (true) {
      const value = await this.peek()
      if (value !== " " && value !== "\n" && value !== "\r" && value !== "\t") return
      this.index += 1
    }
  }

  async string(collect: boolean): Promise<string> {
    await this.expect('"')
    let raw = collect ? '"' : ""
    while (true) {
      const value = await this.take()
      if (value === null) throw new Error("INVALID_BACKUP_JSON")
      if (collect) raw += value
      if (value === '"') return raw
      if (value.charCodeAt(0) < 0x20) throw new Error("INVALID_BACKUP_JSON")
      if (value !== "\\") continue
      const escaped = await this.take()
      if (escaped === null || !['"', "\\", "/", "b", "f", "n", "r", "t", "u"].includes(escaped)) {
        throw new Error("INVALID_BACKUP_JSON")
      }
      if (collect) raw += escaped
      if (escaped !== "u") continue
      for (let index = 0; index < 4; index += 1) {
        const hex = await this.take()
        if (hex === null || !/[0-9a-fA-F]/u.test(hex)) throw new Error("INVALID_BACKUP_JSON")
        if (collect) raw += hex
      }
    }
  }

  async value(collect: boolean, depth = 0): Promise<string> {
    if (depth > MAX_JSON_DEPTH) throw new Error("INVALID_BACKUP_JSON")
    await this.whitespace()
    const first = await this.peek()
    if (first === '"') return this.string(collect)
    if (first === "{") return this.object(collect, depth + 1)
    if (first === "[") return this.array(collect, depth + 1)
    if (first === "t" || first === "f" || first === "n") {
      const literal = first === "t" ? "true" : first === "f" ? "false" : "null"
      for (const char of literal) await this.expect(char)
      return collect ? literal : ""
    }
    if (first === "-" || (first !== null && first >= "0" && first <= "9")) {
      return this.number(collect)
    }
    throw new Error("INVALID_BACKUP_JSON")
  }

  private async number(collect: boolean): Promise<string> {
    let raw = ""
    const take = async () => {
      const value = await this.take()
      if (value === null) throw new Error("INVALID_BACKUP_JSON")
      if (collect) raw += value
    }
    if (await this.peek() === "-") await take()
    const first = await this.peek()
    if (first === "0") await take()
    else {
      if (first === null || first < "1" || first > "9") throw new Error("INVALID_BACKUP_JSON")
      do {
        await take()
        const next = await this.peek()
        if (next === null || next < "0" || next > "9") break
      } while (true)
    }
    if (await this.peek() === ".") {
      await take()
      let digit = await this.peek()
      if (digit === null || digit < "0" || digit > "9") throw new Error("INVALID_BACKUP_JSON")
      while (digit !== null && digit >= "0" && digit <= "9") {
        await take()
        digit = await this.peek()
      }
    }
    const exponent = await this.peek()
    if (exponent === "e" || exponent === "E") {
      await take()
      if (await this.peek() === "+" || await this.peek() === "-") await take()
      let digit = await this.peek()
      if (digit === null || digit < "0" || digit > "9") throw new Error("INVALID_BACKUP_JSON")
      while (digit !== null && digit >= "0" && digit <= "9") {
        await take()
        digit = await this.peek()
      }
    }
    return raw
  }

  private async array(collect: boolean, depth: number): Promise<string> {
    await this.expect("[")
    let raw = collect ? "[" : ""
    await this.whitespace()
    if (await this.peek() === "]") {
      await this.take()
      return collect ? "[]" : ""
    }
    while (true) {
      raw += await this.value(collect, depth)
      await this.whitespace()
      const separator = await this.take()
      if (separator === "]") return collect ? raw + "]" : ""
      if (separator !== ",") throw new Error("INVALID_BACKUP_JSON")
      if (collect) raw += ","
      await this.whitespace()
      if (await this.peek() === "]") throw new Error("INVALID_BACKUP_JSON")
    }
  }

  private async object(collect: boolean, depth: number): Promise<string> {
    await this.expect("{")
    let raw = collect ? "{" : ""
    await this.whitespace()
    if (await this.peek() === "}") {
      await this.take()
      return collect ? "{}" : ""
    }
    while (true) {
      if (await this.peek() !== '"') throw new Error("INVALID_BACKUP_JSON")
      raw += await this.string(collect)
      await this.whitespace()
      await this.expect(":")
      if (collect) raw += ":"
      raw += await this.value(collect, depth)
      await this.whitespace()
      const separator = await this.take()
      if (separator === "}") return collect ? raw + "}" : ""
      if (separator !== ",") throw new Error("INVALID_BACKUP_JSON")
      if (collect) raw += ","
      await this.whitespace()
      if (await this.peek() === "}") throw new Error("INVALID_BACKUP_JSON")
    }
  }

  async entries(): Promise<unknown[]> {
    await this.expect("[")
    const entries: unknown[] = []
    await this.whitespace()
    if (await this.peek() === "]") {
      await this.take()
      return entries
    }
    while (true) {
      entries.push(JSON.parse(await this.value(true)))
      await this.whitespace()
      const separator = await this.take()
      if (separator === "]") return entries
      if (separator !== ",") throw new Error("INVALID_BACKUP_JSON")
      await this.whitespace()
      if (await this.peek() === "]") throw new Error("INVALID_BACKUP_JSON")
    }
  }
}

const KEPT_FIELDS = new Set(["app", "format", "exportedAt", "entries", "decorations", "calendarDecorations"])

/** Read the existing v1-v5 JSON envelope in chunks, parsing entries one at a time. */
export async function readBackupJsonBlob(
  blob: Blob,
  current: () => boolean = () => true,
  chunkBytes = DEFAULT_CHUNK_BYTES,
): Promise<Record<string, unknown>> {
  const cursor = new JsonBlobCursor(blob, current, Math.max(1, Math.floor(chunkBytes)))
  await cursor.whitespace()
  await cursor.expect("{")
  const root: Record<string, unknown> = Object.create(null) as Record<string, unknown>
  await cursor.whitespace()
  if (await cursor.peek() !== "}") {
    while (true) {
      if (await cursor.peek() !== '"') throw new Error("INVALID_BACKUP_JSON")
      const key = JSON.parse(await cursor.string(true)) as string
      await cursor.whitespace()
      await cursor.expect(":")
      await cursor.whitespace()
      if (key === "entries" && await cursor.peek() === "[") root[key] = await cursor.entries()
      else if (KEPT_FIELDS.has(key)) root[key] = JSON.parse(await cursor.value(true))
      else await cursor.value(false)
      await cursor.whitespace()
      const separator = await cursor.take()
      if (separator === "}") break
      if (separator !== ",") throw new Error("INVALID_BACKUP_JSON")
      await cursor.whitespace()
      if (await cursor.peek() === "}") throw new Error("INVALID_BACKUP_JSON")
    }
  } else await cursor.take()
  await cursor.whitespace()
  if (await cursor.peek() !== null) throw new Error("INVALID_BACKUP_JSON")
  return root
}
