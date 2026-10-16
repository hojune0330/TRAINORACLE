import { parseActivityFile } from "./activity-file"
import type { ActivityFileParseOptions, ActivityParseResult } from "./activity-file"

export class ActivityParseCancelled extends Error {
  constructor() { super("Activity parsing cancelled"); this.name = "ActivityParseCancelled" }
}

type ParserWorker = Pick<Worker, "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror">
type WorkerReply = { ok: true; result: ActivityParseResult } | { ok: false }

/** Lazy, per-file device work, never a server upload. XML still needs DOMParser.
 * Browsers without workers use the same bounded parser on the UI thread.
 * Missing chunks/crashes fail visibly, without repeating heavy work on the UI.
 */
export async function parseActivityFileAsync(
  text: string,
  timeZone: string,
  options: ActivityFileParseOptions,
  signal: AbortSignal,
  createWorker = (): ParserWorker => new Worker(new URL("./activity-file.worker.ts", import.meta.url), { type: "module" }),
): Promise<ActivityParseResult> {
  if (signal.aborted) throw new ActivityParseCancelled()
  // XML requires the browser DOM; worker startup costs more than small inputs.
  if (text.length < 64 * 1024 || text.trimStart().startsWith("<") || typeof Worker === "undefined") {
    return parseActivityFile(text, timeZone, options)
  }
  let worker: ParserWorker
  try { worker = createWorker() }
  catch {
    if (signal.aborted) throw new ActivityParseCancelled()
    return parseActivityFile(text, timeZone, options)
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (result?: ActivityParseResult, error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      signal.removeEventListener("abort", abort)
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null
      worker.terminate()
      if (error) reject(error)
      else resolve(result!)
    }
    const abort = () => finish(undefined, new ActivityParseCancelled())
    // Operational ceiling only; no file is truncated to meet it.
    const timeout = setTimeout(() => finish(undefined, new Error("Activity parsing timed out")), 30_000)
    signal.addEventListener("abort", abort, { once: true })
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (signal.aborted) { abort(); return }
      if (event.data?.ok === true) finish(event.data.result)
      else finish(undefined, new Error("Activity parsing failed"))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      finish(undefined, new Error("Activity worker unavailable"))
    }
    worker.onmessageerror = () => finish(undefined, new Error("Activity result unavailable"))
    if (signal.aborted) { abort(); return }
    try { worker.postMessage({ text, timeZone, options }) }
    catch { finish(undefined, new Error("Activity worker unavailable")) }
  })
}
