import { hasUnsafeDrafts } from "./unsaved-draft-navigation"
import { localJournalScopeGeneration } from "./account/local-journal-ownership"
import type { AppTab } from "../components/AppChrome"

const RECOVERY_KEY = "trainoracle.screen-recovery.v1"

export function rememberRecoveryTab(tab: AppTab): void {
  // Only a coarse tab and expiry, never a record ID, form value, or account identifier.
  try { sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ tab, expires: Date.now() + 60_000 })) }
  catch { /* Recovery still works without position restoration. */ }
}

export function readRecoveryTab(): AppTab | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) ?? "null")
    if (!value || typeof value !== "object") return null
    const { tab, expires } = value as Record<string, unknown>
    return typeof expires === "number" && expires > Date.now() && expires <= Date.now() + 60_000
      && ["home", "journal", "log", "plan", "trends"].includes(String(tab)) ? tab as AppTab : null
  } catch { return null }
}

export function clearRecoveryTab(): void {
  try { sessionStorage.removeItem(RECOVERY_KEY) } catch { /* No user data is touched. */ }
}

let interruptedDraftGeneration: number | null = null

export function captureInterruptedDraft(): boolean {
  const generation = localJournalScopeGeneration()
  if (hasUnsafeDrafts()) interruptedDraftGeneration = generation
  return interruptedDraftGeneration === generation
}

export function isReloadBlocked(): boolean {
  return interruptedDraftGeneration === localJournalScopeGeneration() || hasUnsafeDrafts()
}

export function isScreenAssetFailure(message: string): boolean {
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(message)
}

export type ReloadResult = "reloading" | "unavailable" | "draft-blocked" | "cancelled"

export async function reloadScreenAssets(options: {
  unsafeAtFailure: boolean
  beforeReload?: () => void
  fetchEntry?: typeof fetch
  reload?: () => void
  isCurrent?: () => boolean
}): Promise<ReloadResult> {
  if (options.unsafeAtFailure || isReloadBlocked()) return "draft-blocked"
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 6_000)
  try {
    const url = new URL(window.location.href)
    url.search = ""
    url.hash = ""
    url.searchParams.set("screen-recovery-check", "1")
    const response = await (options.fetchEntry ?? fetch)(url.href, {
      cache: "no-store", credentials: "omit", signal: controller.signal,
    })
    if (options.isCurrent && !options.isCurrent()) return "cancelled"
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return "unavailable"
    // Input may have changed while the connection check was pending.
    if (isReloadBlocked()) return "draft-blocked"
    options.beforeReload?.()
    ;(options.reload ?? (() => window.location.reload()))()
    return "reloading"
  } catch { return "unavailable" }
  finally { window.clearTimeout(timeout) }
}
