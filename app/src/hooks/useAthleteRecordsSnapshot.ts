import { useEffect, useReducer } from "react"
import { loadAthleteRecords, type AthleteRecord } from "../domain/athlete-records"
import { activeLocalAccount, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { ACCOUNT_ATHLETE_RECORD_EVENT, accountAthleteRecordsEnabled, readAccountAthleteRecordsState } from "../domain/account/account-athlete-record-service"

export function readAthleteRecordsSnapshot() {
  const ownerId = activeLocalAccount()
  if (ownerId === null || !accountAthleteRecordsEnabled()) {
    return { ownerId, records: loadAthleteRecords(), status: "READY" as const, message: null }
  }
  const state = readAccountAthleteRecordsState()
  const ready = state.ownerId === ownerId && state.status === "READY" && state.confirmed
  const empty = state.ownerId === ownerId && (state.status === "EMPTY" || state.status === "DELETED")
  const waiting = state.status === "IDLE" || state.status === "LOADING"
  return {
    ownerId,
    records: ready ? state.records : [] as AthleteRecord[],
    status: ready || empty ? "READY" as const : waiting ? "LOADING" as const : "UNAVAILABLE" as const,
    message: ready || empty ? null : waiting ? "계정의 경기 기록을 불러오고 있어요." : "계정의 경기 기록을 확인하지 못했어요. 기록 화면에서 저장 상태를 확인해 주세요.",
  }
}

export function useAthleteRecordsSnapshot() {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => {
    const events = [ACCOUNT_ATHLETE_RECORD_EVENT, "storage", "focus"]
    events.forEach(event => window.addEventListener(event, refresh))
    const stop = onLocalJournalScopeChange(refresh)
    refresh()
    return () => { stop(); events.forEach(event => window.removeEventListener(event, refresh)) }
  }, [])
  return readAthleteRecordsSnapshot()
}
