import { useEffect, useReducer, useState } from "react"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { ALL_WORKOUT_CATALOG } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding, type CatalogSessionBinding } from "@impl/prescription/catalog-session-binding"
import { accountJournalBackupReady, currentConfirmedAccountJournalRevision, readCurrentConfirmedAccountJournalProjection } from "../domain/account/account-journal-projection"
import { ACCOUNT_PLAN_EVENT, accountPlanService, accountPlansEnabled } from "../domain/account/account-plan-service"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from "../domain/account/local-journal-ownership"
import { isValidIsoDate } from "../domain/dates"
import { buildFileAnalysisReport, type ProjectedFileObservation } from "../domain/import/file-analysis"
import { LOCAL_JOURNALS_CHANGED } from "../domain/journal-change-events"
import type { OraclePeriod, OracleReaderSource } from "../domain/oracle-content-reader"
import type { PlanBetaState } from "../domain/plan-beta-schema"
import { readPlanBetaStateFromStorage } from "../domain/plan-beta-store"
import { createPlannedSessionLogDraft } from "../domain/planned-session-link"

export interface OracleReadingSourceOption {
  readonly key: string
  readonly label: string
  readonly date: string
}
export interface OracleReadingSources {
  readonly fileOptions: readonly OracleReadingSourceOption[]
  readonly methodOptions: readonly OracleReadingSourceOption[]
  readonly selectedFileKey: string | null
  readonly setSelectedFileKey: (key: string | null) => void
  readonly selectedMethodKey: string | null
  readonly setSelectedMethodKey: (key: string | null) => void
  readonly fileLaps: OracleReaderSource<ProjectedFileObservation>
  readonly catalogMethod: OracleReaderSource<CatalogSessionBinding>
  readonly cyclePeriod: OracleReaderSource<OraclePeriod>
}

type Ready<T> = Extract<OracleReaderSource<T>, { state: "READY" }>
type Choice<T> = { option: OracleReadingSourceOption; source: Ready<T> }
type Choices<T> = { state: "MISSING" | "UNAVAILABLE"; rows: readonly Choice<T>[] }
const unavailable = { state: "UNAVAILABLE" } as const
const missing = { state: "MISSING" } as const
const keyFor = (value: unknown) => canonicalJsonFingerprint("trainoracle.oracle-reading-selection.v1", value)
const sportLabels = { RUNNING: "달리기", WALKING: "걷기", CYCLING: "자전거", OTHER: "기타 운동", UNKNOWN: "종목 미확인" } as const

function fileChoices(): Choices<ProjectedFileObservation> {
  if (!activeLocalAccount() || !accountJournalBackupReady()) return { ...unavailable, rows: [] }
  const entries = readCurrentConfirmedAccountJournalProjection().map(entry => ({
    id: entry.id, kind: entry.kind, date: entry.date,
    fileObservation: "fileObservation" in entry ? entry.fileObservation : undefined,
  }))
  // Process the entire confirmed list together so source-key conflicts cannot be hidden by selection.
  const report = buildFileAnalysisReport(entries, { startDate: "0100-01-01", endDate: "9999-12-31", sourceContext: "ACCOUNT_CONFIRMED" })
  const rows: Choice<ProjectedFileObservation>[] = []
  for (const observation of report.observations) {
    const revision = currentConfirmedAccountJournalRevision(observation.journalEntryId)
    if (revision === null || observation.laps.length === 0) continue
    const key = keyFor([localJournalScopeGeneration(), observation.journalEntryId, revision,
      observation.sourceObservationKey, observation.contentRevisionFingerprint, observation.sport,
      observation.durationMeaning, observation.durationMeaningConfirmed])
    rows.push({ option: { key, date: observation.date, label: `${observation.date} · ${sportLabels[observation.sport]} · ${observation.laps.length}개 구간 (${observation.format.toUpperCase()})` },
      source: { state: "READY", sourceVersion: `FILE_ANALYSIS_V1_REV_${revision}`, data: observation,
        coverage: report.coverage === "DATA" ? "COMPLETE" : "PARTIAL" } })
  }
  return { state: report.coverage === "ALL_EXCLUDED" ? "UNAVAILABLE" : "MISSING",
    rows: rows.sort((a, b) => b.option.date.localeCompare(a.option.date) || a.option.key.localeCompare(b.option.key)) }
}

function currentPlan(): OracleReaderSource<PlanBetaState> {
  if (activeLocalAccount()) {
    if (!accountPlansEnabled()) return unavailable
    const view = accountPlanService()?.snapshot()
    if (!view || (view.status !== "READY" && view.status !== "EMPTY")) return unavailable
    if (!view.currentPlan) return missing
    const selected = view.currentPlan
    if (selected.kind !== "read_only" || selected.packet.state.version !== 3) return unavailable
    return { state: "READY", sourceVersion: keyFor([view.fingerprint, selected.planId]), data: selected.packet.state }
  }
  const read = readPlanBetaStateFromStorage()
  if (read.kind === "missing") return missing
  if (read.kind !== "loaded") return unavailable
  return { state: "READY", sourceVersion: keyFor([read.state.generatedAt, read.state.intake.startDate ?? null, read.state.activePlan]), data: read.state }
}

/** Actual stored session dates, not a rounded frameLengthDays or a rolling/monthly window. */
export function oracleReadingCyclePeriod(today: string, plan: OracleReaderSource<PlanBetaState>): OracleReaderSource<OraclePeriod> {
  if (plan.state !== "READY") return { state: plan.state }
  if (!isValidIsoDate(today) || plan.data.version === 1) return unavailable
  const dates: string[] = []
  for (const session of plan.data.activePlan.sessions) {
    const draft = createPlannedSessionLogDraft(plan.data, session, plan.data.generatedAt)
    if (!draft || !isValidIsoDate(draft.date)) return unavailable
    dates.push(draft.date)
  }
  if (dates.length === 0) return unavailable
  dates.sort()
  const startDate = dates[0]!, endDate = dates[dates.length - 1]! < today ? dates[dates.length - 1]! : today
  if (startDate > endDate) return missing
  return { state: "READY", sourceVersion: plan.sourceVersion, data: { startDate, endDate }, coverage: plan.coverage }
}

function methodChoices(plan: OracleReaderSource<PlanBetaState>): Choices<CatalogSessionBinding> {
  if (plan.state !== "READY") return { state: plan.state === "MISSING" ? "MISSING" : "UNAVAILABLE", rows: [] }
  if (plan.data.version === 1) return { ...unavailable, rows: [] }
  const rows: Choice<CatalogSessionBinding>[] = []
  let invalid = false
  for (const session of plan.data.activePlan.sessions) {
    const prescription = session.prescription
    if (prescription.kind !== "RPE_TIME_RANGE" || !prescription.catalogWorkout) continue
    const binding = prescription.catalogWorkout
    const catalog = ALL_WORKOUT_CATALOG.find(row => row.id === binding.catalogId && row.fingerprint === binding.catalogFingerprint)
    const draft = createPlannedSessionLogDraft(plan.data, session, plan.data.generatedAt)
    if (!draft || !catalog || !resolveCatalogBinding(binding)) { invalid = true; continue }
    const key = keyFor([localJournalScopeGeneration(), plan.sourceVersion, draft.link.plannedSessionId, binding.calculationFingerprint])
    rows.push({ option: { key, date: draft.date, label: `${draft.date} · ${session.slot === "AM" ? "오전" : "오후"} · ${catalog.name}` },
      source: { state: "READY", sourceVersion: plan.sourceVersion, data: binding, coverage: plan.coverage } })
  }
  return { state: invalid ? "UNAVAILABLE" : "MISSING", rows }
}

function sources(today: string) {
  // An optional source failure must not suppress an independently available source.
  let files: Choices<ProjectedFileObservation>
  let plan: OracleReaderSource<PlanBetaState>
  try { files = fileChoices() } catch { files = { ...unavailable, rows: [] } }
  try { plan = currentPlan() } catch { plan = unavailable }
  let methods: Choices<CatalogSessionBinding>, cyclePeriod: OracleReaderSource<OraclePeriod>
  try { methods = methodChoices(plan); cyclePeriod = oracleReadingCyclePeriod(today, plan) }
  catch { methods = { ...unavailable, rows: [] }; cyclePeriod = unavailable }
  return { files, methods, cyclePeriod }
}
const hasKey = <T,>(choices: Choices<T>, key: string | null) => key !== null && choices.rows.some(row => row.option.key === key)
const selectedSource = <T,>(choices: Choices<T>, key: string | null): OracleReaderSource<T> =>
  choices.rows.find(row => row.option.key === key)?.source ?? { state: choices.state }

/** Read-only: no fetch, hydration, default selection, plan writes, or memo-bearing output. */
export function useOracleReadingSources(today: string): OracleReadingSources {
  const [, refresh] = useReducer((value: number) => value + 1, 0)
  const [selection, setSelection] = useState<{ file: string | null; method: string | null }>({ file: null, method: null })
  const scope = localJournalScopeGeneration()
  const snapshot = sources(today)
  const selectedFileKey = hasKey(snapshot.files, selection.file) ? selection.file : null
  const selectedMethodKey = hasKey(snapshot.methods, selection.method) ? selection.method : null

  useEffect(() => {
    const invalidate = () => {
      const next = sources(today)
      // Capture each event's state before React batches updates: failed -> ready must not resurrect a selection.
      setSelection(previous => ({ file: hasKey(next.files, previous.file) ? previous.file : null,
        method: hasKey(next.methods, previous.method) ? previous.method : null }))
      refresh()
    }
    const unsubscribe = onLocalJournalScopeChange(invalidate)
    const events = [ACCOUNT_PLAN_EVENT, LOCAL_JOURNALS_CHANGED, "trainoracle:account-journals-changed", "storage", "focus"]
    events.forEach(event => window.addEventListener(event, invalidate))
    invalidate()
    return () => { unsubscribe(); events.forEach(event => window.removeEventListener(event, invalidate)) }
  }, [today])

  useEffect(() => {
    setSelection(previous => previous.file === selectedFileKey && previous.method === selectedMethodKey ? previous
      : { file: selectedFileKey, method: selectedMethodKey })
  }, [selectedFileKey, selectedMethodKey])

  const select = (kind: "file" | "method", key: string | null) => {
    if (scope !== localJournalScopeGeneration()) return
    const next = sources(today)
    const eligible = kind === "file" ? hasKey(next.files, key) : hasKey(next.methods, key)
    setSelection(previous => ({ ...previous, [kind]: eligible ? key : null }))
  }
  return { fileOptions: snapshot.files.rows.map(row => row.option), methodOptions: snapshot.methods.rows.map(row => row.option),
    selectedFileKey, setSelectedFileKey: key => select("file", key), selectedMethodKey, setSelectedMethodKey: key => select("method", key),
    fileLaps: selectedSource(snapshot.files, selectedFileKey), catalogMethod: selectedSource(snapshot.methods, selectedMethodKey),
    cyclePeriod: snapshot.cyclePeriod }
}
