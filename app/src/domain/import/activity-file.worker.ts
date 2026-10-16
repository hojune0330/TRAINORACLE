import { parseActivityFile } from "./activity-file"
import type { ActivityFileParseOptions } from "./activity-file"

// One request per worker. No network, account, storage or logging capability is
// used here. The existing parser remains the only source of numeric semantics.
self.onmessage = (event: MessageEvent<{ text: string; timeZone: string; options: ActivityFileParseOptions }>) => {
  try {
    const { text, timeZone, options } = event.data
    self.postMessage({ ok: true, result: parseActivityFile(text, timeZone, options) })
  } catch {
    self.postMessage({ ok: false })
  }
}
