import { useEffect, useRef, useState } from "react"
import { accountScopedStorageKey } from "../../domain/account/local-account-scope"
import { localJournalScopeGeneration } from "../../domain/account/local-journal-ownership"
import { readSavedRun, removeSavedRun, SAVED_RUN_KEY, writeSavedRun } from "../../domain/minigame/saved-run"
import type { SavedRunRead } from "../../domain/minigame/saved-run"
import type { TreadmillState } from "../../domain/minigame/treadmill"

export function useSavedRun() {
  const scope = useRef({ key: accountScopedStorageKey(SAVED_RUN_KEY), generation: localJournalScopeGeneration() })
  const current = () => scope.current.generation === localJournalScopeGeneration()
  const read = (): SavedRunRead => {
    try { return current() ? readSavedRun(window.localStorage, scope.current.key) : { kind: "unavailable", raw: null } }
    catch { return { kind: "unavailable", raw: null } }
  }
  const [slot, setSlot] = useState<SavedRunRead>(read)
  const latest = useRef(slot)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => { const next = read(); latest.current = next; setSlot(next) }
  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === scope.current.key) refresh() }
    window.addEventListener("storage", changed)
    return () => window.removeEventListener("storage", changed)
  }, [])
  const save = (course: string, state: TreadmillState) => {
    try {
      if (!current() || latest.current.kind === "unavailable" || !writeSavedRun(window.localStorage, scope.current.key, course, state, latest.current.raw)) throw Error()
      refresh(); setError(null); return true
    } catch {
      refresh(); setError("저장하지 못했어요. 이 화면에서 계속하거나 다시 저장해 주세요."); return false
    }
  }
  const clear = () => {
    try {
      if (!current() || latest.current.kind === "unavailable" || !removeSavedRun(window.localStorage, scope.current.key, latest.current.raw)) throw Error()
      refresh(); setError(null); return true
    } catch {
      refresh(); setError("저장된 판을 확인하지 못했어요. 다른 창에서 변경했거나 기기 저장이 차단됐을 수 있어요."); return false
    }
  }
  return { slot, error, save, clear, refresh, clearError: () => setError(null) }
}
