export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024

export class ActivityFileReadError extends Error {
  readonly kind: "cancelled" | "unreadable"

  constructor(kind: "cancelled" | "unreadable") {
    super(kind === "cancelled" ? "activity import cancelled" : "activity file read failed")
    this.name = "ActivityFileReadError"
    this.kind = kind
  }
}

export function readActivityFileText(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new ActivityFileReadError("cancelled"))
      return
    }

    const reader = new FileReader()
    let settled = false
    const cleanup = () => signal.removeEventListener("abort", abort)
    const succeed = (text: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(text)
    }
    const fail = (kind: "cancelled" | "unreadable") => {
      if (settled) return
      settled = true
      cleanup()
      reject(new ActivityFileReadError(kind))
    }
    const abort = () => {
      reader.abort()
      fail("cancelled")
    }

    reader.onload = () => {
      if (typeof reader.result === "string") succeed(reader.result)
      else fail("unreadable")
    }
    reader.onerror = () => fail("unreadable")
    reader.onabort = () => fail("cancelled")
    signal.addEventListener("abort", abort, { once: true })
    reader.readAsText(file)
  })
}
