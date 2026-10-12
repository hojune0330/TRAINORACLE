/**
 * Where minigame progress lives: this device (account-scoped localStorage) first, then the
 * account document when signed in. Game data only — never training records or reward points.
 */
import React from "react"
import { accountScopedStorageKey } from "../account/local-account-scope"
import { activeLocalAccount, localJournalScopeGeneration } from "../account/local-journal-ownership"
import { createMinigameProgressSync, minigameAccountStorageEnabled, type MinigameSyncStatus } from "../account/account-minigame-progress-service"
import { emptyMinigameProgress, mergeMinigameProgress, minigameProgressSchema, sameMinigameProgress, type MinigameProgress } from "./progress"

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
  const scope = React.useRef({ owner: activeLocalAccount(), generation: localJournalScopeGeneration() })
  const mounted = React.useRef(true)
  const lifecycle = React.useRef(0)
  const resetting = React.useRef(false)
  const current = React.useCallback(() => mounted.current
    && activeLocalAccount() === scope.current.owner && localJournalScopeGeneration() === scope.current.generation, [])

  const push = React.useCallback(() => {
    if (!current()) return
    if (resetting.current) { again.current = true; return }
    const owner = scope.current.owner
    if (!owner || !minigameAccountStorageEnabled()) { setStatus("DEVICE"); return }
    if (syncing.current) { again.current = true; return }
    const generation = lifecycle.current
    const isCurrent = () => current() && lifecycle.current === generation
    setStatus("SYNCING")
    const task: Promise<void> = createMinigameProgressSync(owner, { isCurrent }).sync(latest.current).then(result => {
      if (!isCurrent()) return
      // A run or settings edit may finish while the account request is in flight.
      // Merge its answer into the working copy before retrying those newer changes.
      const merged = mergeMinigameProgress(latest.current, result.progress)
      if (!sameMinigameProgress(merged, latest.current)) {
        latest.current = merged; saveLocalMinigameProgress(merged); setProgress(merged)
      }
      setStatus(result.status)
    }).finally(() => {
      if (syncing.current !== task) return
      syncing.current = null
      if (isCurrent() && !resetting.current && again.current) { again.current = false; push() }
    })
    syncing.current = task
  }, [current])

  React.useEffect(() => {
    mounted.current = true
    push()
    const retry = () => push()
    window.addEventListener("online", retry)
    return () => {
      mounted.current = false; lifecycle.current += 1; syncing.current = null; again.current = false
      window.removeEventListener("online", retry)
    }
  }, [push])

  const update = React.useCallback((change: (current: MinigameProgress) => MinigameProgress) => {
    if (!current() || resetting.current) return
    const next = change(latest.current)
    if (next === latest.current) return
    latest.current = next; saveLocalMinigameProgress(next); setProgress(next); push()
  }, [current, push])

  /** Deletes the account copy first (when there is one), then the device copy. */
  const reset = React.useCallback(async () => {
    if (!current() || resetting.current) return false
    const owner = scope.current.owner
    const generation = lifecycle.current
    const isCurrent = () => current() && lifecycle.current === generation
    resetting.current = true; again.current = false
    try {
      // An older save must finish before deletion; otherwise its late response can
      // recreate the account copy or restore cities in the device working copy.
      await syncing.current
      if (!isCurrent()) return false
      if (owner && minigameAccountStorageEnabled() && !await createMinigameProgressSync(owner, { isCurrent }).reset()) return false
      if (!isCurrent()) return false
      lifecycle.current += 1; again.current = false
      const fresh = { ...emptyMinigameProgress(), character: latest.current.character, settings: latest.current.settings, settingsUpdatedAt: latest.current.settingsUpdatedAt }
      latest.current = fresh; saveLocalMinigameProgress(fresh); setProgress(fresh); setStatus("DEVICE")
      return true
    } finally {
      resetting.current = false
      if (current() && again.current) { again.current = false; push() }
    }
  }, [current, push])

  return { progress, status, update, reset }
}
