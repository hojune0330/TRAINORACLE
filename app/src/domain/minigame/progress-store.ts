/**
 * Where minigame progress lives: this device (account-scoped localStorage) first, then the
 * account document when signed in. Game data only — never training records or reward points.
 */
import React from "react"
import { accountScopedStorageKey } from "../account/local-account-scope"
import { activeLocalAccount } from "../account/local-journal-ownership"
import { createMinigameProgressSync, minigameAccountStorageEnabled, type MinigameSyncStatus } from "../account/account-minigame-progress-service"
import { emptyMinigameProgress, minigameProgressSchema, type MinigameProgress } from "./progress"

export const MINIGAME_PROGRESS_STORAGE_KEY = "trainoracle.minigame.progress.v1"

function storage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage } catch { return null }
}

export function loadLocalMinigameProgress(): MinigameProgress {
  try {
    const raw = storage()?.getItem(accountScopedStorageKey(MINIGAME_PROGRESS_STORAGE_KEY))
    if (!raw) return emptyMinigameProgress()
    const parsed = minigameProgressSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : emptyMinigameProgress()
  } catch { return emptyMinigameProgress() }
}

export function saveLocalMinigameProgress(progress: MinigameProgress): boolean {
  const parsed = minigameProgressSchema.safeParse(progress)
  if (!parsed.success) return false
  try { storage()?.setItem(accountScopedStorageKey(MINIGAME_PROGRESS_STORAGE_KEY), JSON.stringify(parsed.data)); return true } catch { return false }
}

export type MinigameStorageStatus = MinigameSyncStatus | "SYNCING" | "DEVICE"

/**
 * React binding: the device copy is the working copy (instant, offline), and every change is
 * merged into the account copy in the background when account storage is available.
 */
export function useMinigameProgress() {
  const [progress, setProgress] = React.useState<MinigameProgress>(loadLocalMinigameProgress)
  const [status, setStatus] = React.useState<MinigameStorageStatus>(() => minigameAccountStorageEnabled() ? "SYNCING" : "DEVICE")
  const latest = React.useRef(progress)
  const syncing = React.useRef<Promise<void> | null>(null)
  const again = React.useRef(false)

  const push = React.useCallback(() => {
    const owner = activeLocalAccount()
    if (!owner || !minigameAccountStorageEnabled()) { setStatus("DEVICE"); return }
    if (syncing.current) { again.current = true; return }
    setStatus("SYNCING")
    syncing.current = createMinigameProgressSync(owner).sync(latest.current).then(result => {
      if (activeLocalAccount() !== owner) return
      if (JSON.stringify(result.progress) !== JSON.stringify(latest.current)) {
        latest.current = result.progress; saveLocalMinigameProgress(result.progress); setProgress(result.progress)
      }
      setStatus(result.status)
    }).finally(() => {
      syncing.current = null
      if (again.current) { again.current = false; push() }
    })
  }, [])

  React.useEffect(() => {
    push()
    const retry = () => push()
    window.addEventListener("online", retry)
    return () => window.removeEventListener("online", retry)
  }, [push])

  const update = React.useCallback((change: (current: MinigameProgress) => MinigameProgress) => {
    const next = change(latest.current)
    if (next === latest.current) return
    latest.current = next; saveLocalMinigameProgress(next); setProgress(next); push()
  }, [push])

  /** Deletes the account copy first (when there is one), then the device copy. */
  const reset = React.useCallback(async () => {
    const owner = activeLocalAccount()
    if (owner && minigameAccountStorageEnabled() && !await createMinigameProgressSync(owner).reset()) return false
    const fresh = { ...emptyMinigameProgress(), character: latest.current.character, settings: latest.current.settings, settingsUpdatedAt: latest.current.settingsUpdatedAt }
    latest.current = fresh; saveLocalMinigameProgress(fresh); setProgress(fresh)
    return true
  }, [])

  return { progress, status, update, reset }
}
