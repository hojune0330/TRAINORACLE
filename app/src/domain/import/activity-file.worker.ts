import { parseActivityFile, parseActivityFileBytes } from "./activity-file"
import type { ActivityFileParseOptions } from "./activity-file"

// One request per worker. No network, account, storage or logging capability is
// used here. The existing parser remains the only source of numeric semantics.
self.onmessage = async (event: MessageEvent<{ text: string | Uint8Array; timeZone: string; options: ActivityFileParseOptions }>) => {
  try {
    const { text, timeZone, options } = event.data
    const result = typeof text === "string" ? parseActivityFile(text, timeZone, options) : await parseActivityFileBytes(text, timeZone, options)
    self.postMessage({ ok: true, result })
  } catch {
    self.postMessage({ ok: false })
  }
}
