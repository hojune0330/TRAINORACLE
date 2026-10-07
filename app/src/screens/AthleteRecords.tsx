import React from "react"
import { ArrowLeft, ArrowRight, CalendarDays, Save } from "lucide-react"
import { InfoDisclosure } from "../components/InfoDisclosure"
import { useAppOverlayNavigation } from "../components/AppOverlayNavigation"
import { paceClock } from "../domain/pace-tools"
import { registerUnsavedDraftGuard, runDraftSafeNavigation } from "../domain/unsaved-draft-navigation"
import { canonicalPaceDistance } from "@impl/prescription/record-pace"
import {
  achievedDateError,
  createSelfReportedAthleteRecord,
  loadAthleteRecords,
  saveAthleteRecord,
  cacheConfirmedAthleteRecords,
} from "../domain/athlete-records"
import type { AthleteRecord, RecordPurpose } from "../domain/athlete-records"
import { AthleteRecordRow } from "./athlete-records/AthleteRecordRow"
import { PacePlanUpdateNotice } from "./athlete-records/PacePlanUpdateNotice"
import { loadVersionedPlanBetaState } from "../domain/plan-beta-store"
import { prepareCurrentPaceUpdate } from "../domain/active-plan-edit-store"
import { isEligiblePaceRecordCurrent } from "../domain/account/eligible-account-pace-records"
import { localAccountScopeSnapshot, localAccountScopeIsCurrent } from "../domain/account/local-account-scope"
import { ACCOUNT_ATHLETE_RECORD_EVENT, accountAthleteRecordsEnabled, addAccountAthleteRecord, loadAccountAthleteRecords, readAccountAthleteRecordsState } from "../domain/account/account-athlete-record-service"

const DISTANCE_OPTIONS = [
  ["800", "800m"],
  ["1500", "1500m"],
  ["3000", "3000m"],
  ["5000", "5000m"],
  ["10000", "10km"],
  ["21097.5", "하프마라톤 · 21.0975km"],
  ["42195", "마라톤 · 42.195km"],
  ["CUSTOM", "직접 입력"],
] as const

const PURPOSE_OPTIONS: ReadonlyArray<readonly [RecordPurpose, string]> = [
  ["PERSONAL_BEST", "개인 최고"],
  ["RECENT_RESULT", "최근 경기"],
  ["RACE_GOAL", "경기 목표"],
]

const RECORD_MINUTE_EXAMPLES: Readonly<Record<string, string>> = {
  "800": "2", "1500": "4", "3000": "12", "5000": "20", "10000": "40", "21097.5": "100", "42195": "240",
}

export function AthleteRecords({ onBack, onSaved, backLabel = "계획으로", initialPurpose = "RECENT_RESULT", preserveMountedDraftsOnBack = false }: {
  readonly onBack: () => void
  readonly onSaved?: (() => void) | undefined
  readonly backLabel?: string | undefined
  readonly initialPurpose?: "PERSONAL_BEST" | "RECENT_RESULT" | undefined
  /** Only a caller that keeps its draft mounted may preserve that draft on return. */
  readonly preserveMountedDraftsOnBack?: boolean
}) {
  const navigation = useAppOverlayNavigation()
  const [records, setRecords] = React.useState(() => loadAthleteRecords(new Date()))
  const [purpose, setPurpose] = React.useState<RecordPurpose>(initialPurpose)
  const [distanceOption, setDistanceOption] = React.useState(() => {
    if (backLabel !== "계획으로") return "5000"
    const plan = loadVersionedPlanBetaState()
    const distance = plan?.version === 3 ? String(canonicalPaceDistance(plan.activePlan.eventDistanceM)) : "5000"
    return DISTANCE_OPTIONS.some(([value]) => value === distance) ? distance : "5000"
  })
  const [customDistance, setCustomDistance] = React.useState("")
  const [minutes, setMinutes] = React.useState("")
  const [seconds, setSeconds] = React.useState("")
  const [achievedOn, setAchievedOn] = React.useState("")
  const [seasonId, setSeasonId] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [updateRecord, setUpdateRecord] = React.useState<AthleteRecord | null>(null)
  const [explicitPaceBasis, setExplicitPaceBasis] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [pendingRecord, setPendingRecord] = React.useState<AthleteRecord | null>(null)
  const [storageMessage, setStorageMessage] = React.useState("")
  const [lastSavedRecord, setLastSavedRecord] = React.useState<AthleteRecord | null>(null)
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [entryStep, setEntryStep] = React.useState<"event" | "time" | "date">("event")
  const saveLock = React.useRef(false)
  const unsafeDraft = React.useRef(false)
  unsafeDraft.current = pendingRecord === null && [minutes, seconds, achievedOn, customDistance, seasonId].some(value => value.trim() !== "")
  React.useEffect(() => registerUnsavedDraftGuard({
    isUnsafe: () => unsafeDraft.current,
    onBlocked: () => setError("입력한 기록을 먼저 저장해 주세요."),
    confirmDiscard: () => !saveLock.current && window.confirm("저장하지 않은 기록을 지우고 나갈까요?"),
    discard: () => { unsafeDraft.current = false },
  }), [])
  React.useEffect(() => {
    const refresh = () => {
      const current = readAccountAthleteRecordsState()
      if (current.confirmed && current.ownerId) cacheConfirmedAthleteRecords(current.records, current.ownerId)
      setRecords(loadAthleteRecords())
    }
    window.addEventListener(ACCOUNT_ATHLETE_RECORD_EVENT, refresh)
    if (localAccountScopeSnapshot() && accountAthleteRecordsEnabled()) void loadAccountAthleteRecords().then(refresh).catch(() => undefined)
    return () => window.removeEventListener(ACCOUNT_ATHLETE_RECORD_EVENT, refresh)
  }, [])
  const [errorField, setErrorField] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLFormElement>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const errorId = React.useId()
  const showError = (message: string, field: string | null = null) => {
    setError(message)
    setErrorField(field)
    if (field) {
      const input = formRef.current?.querySelector<HTMLInputElement>(`[data-record-field="${field}"]`)
      input?.focus({ preventScroll: true })
      input?.scrollIntoView?.({ block: "center", behavior: "auto" })
    }
  }
  const fieldProps = (name: string) => ({ "data-record-field": name,
    "aria-invalid": errorField === name || undefined,
    "aria-describedby": errorField === name ? errorId : undefined })
  const fieldError = (name: string) => errorField === name && <span id={errorId} className="athlete-record-error" role="alert">{error}</span>
  React.useEffect(() => { headingRef.current?.focus({ preventScroll: true }) }, [entryStep])

  const readDistance = (): number | null => {
    const distance = Number(distanceOption === "CUSTOM" ? customDistance : distanceOption)
    if (!Number.isFinite(distance) || distance < 60) {
      showError("종목 거리는 60m 이상으로 입력해 주세요.", "distance")
      return null
    }
    return distance
  }

  const readPerformanceSeconds = (): number | null => {
    const minutesText = minutes.trim(), secondsText = seconds.trim()
    const parsedMinutes = Number(minutesText || "0")
    const parsedSeconds = Number(secondsText || "0")
    if (
      minutesText !== "" && !/^\d+$/.test(minutesText)
      || secondsText !== "" && !/^\d+(?:\.\d+)?$/.test(secondsText)
      || !Number.isInteger(parsedMinutes)
      || parsedMinutes < 0
      || !Number.isFinite(parsedSeconds)
      || parsedSeconds < 0
      || parsedSeconds >= 60
      || parsedMinutes * 60 + parsedSeconds <= 0
    ) {
      showError("기록의 분과 초를 다시 확인해 주세요.",
        secondsText !== "" && !/^\d+(?:\.\d+)?$/.test(secondsText) || !Number.isFinite(parsedSeconds) || parsedSeconds < 0 || parsedSeconds >= 60 ? "seconds" : "minutes")
      return null
    }
    return parsedMinutes * 60 + parsedSeconds
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saveLock.current || pendingRecord) return
    const now = new Date()
    const distance = readDistance()
    if (distance === null) return
    const performanceSeconds = readPerformanceSeconds()
    if (performanceSeconds === null) return
    if (purpose !== "RACE_GOAL" && achievedOn !== "") {
      const dateError = achievedDateError(achievedOn, now)
      if (dateError === "FUTURE_DATE") {
        showError("미래 달성일은 저장할 수 없어요.", "date")
        return
      }
      if (dateError === "INVALID_DATE") {
        showError("달성일을 YYYY-MM-DD로 입력해 주세요.", "date")
        return
      }
    }
    if (purpose === "SEASON_BEST" && seasonId.trim() === "") {
      showError("시즌 최고 기록에는 시즌 이름이 필요해요.", "season")
      return
    }
    const id = newLocalRecordId()
    const record = createSelfReportedAthleteRecord({
      id,
      purpose,
      eventDistanceM: distance,
      performanceSeconds,
      achievedOn: purpose === "RACE_GOAL" || achievedOn === "" ? null : achievedOn,
      seasonId: purpose === "SEASON_BEST" ? seasonId.trim() : null,
    }, now)
    if (record === null) {
      showError("입력 내용을 다시 확인해 주세요.")
      return
    }
    saveLock.current = true; setSaving(true)
    const scope = localAccountScopeSnapshot()
    try {
      if (scope) {
        if (!accountAthleteRecordsEnabled()) { showError("계정 저장에 연결되지 않았어요. 입력한 내용은 그대로 두었어요."); return }
        const current = await loadAccountAthleteRecords()
        if (!localAccountScopeIsCurrent(scope)) return
        if (!["READY", "EMPTY"].includes(current.status) || current.serverRevision === null) {
          showError("계정의 경기 기록을 확인하지 못했어요. 연결 후 다시 저장해 주세요."); return
        }
        const result = await addAccountAthleteRecord(record, current.serverRevision)
        if (!localAccountScopeIsCurrent(scope)) return
        if (!result.ok) { showError("계정 저장을 확인하지 못했어요. 입력 내용은 그대로예요."); return }
        if (result.storage === "PENDING") {
          setPendingRecord(record); setStorageMessage("전송 대기로 보관했어요. 아직 계정에 저장됐다고 확인되지는 않았어요."); return
        }
        if (!cacheConfirmedAthleteRecords(result.state.records, scope, now)) {
          setPendingRecord(record)
          setStorageMessage("계정에는 저장했지만 이 기기의 목록을 갱신하지 못했어요. 입력 내용은 그대로 두었어요.")
          return
        }
        setStorageMessage("계정에 경기 기록을 저장했어요.")
      } else {
        if (!saveAthleteRecord(record, now).ok) { showError("기록을 저장하지 못했어요. 저장 공간을 확인해 주세요."); return }
        setStorageMessage("이 기기에 경기 기록을 저장했어요.")
      }
      await finishSaved(record)
    } catch { showError("저장 결과를 확인하지 못했어요. 입력 내용은 그대로예요.") }
    finally { saveLock.current = false; setSaving(false) }
  }

  const handleStepSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (entryStep === "event") {
      if (readDistance() === null) return
      if (purpose === "SEASON_BEST" && seasonId.trim() === "") {
        showError("시즌 최고 기록에는 시즌 이름이 필요해요.", "season")
        return
      }
      setError(null); setErrorField(null); setEntryStep("time")
      return
    }
    if (entryStep === "time") {
      if (readPerformanceSeconds() === null) return
      setError(null); setErrorField(null); setEntryStep("date")
      return
    }
    void handleSave(event)
  }

  const finishSaved = async (record: AthleteRecord) => {
    const now = new Date(), distance = record.eventDistanceM
    setLastSavedRecord(record)
    setRecords(loadAthleteRecords(now))
    setMinutes("")
    setSeconds("")
    setAchievedOn("")
    setSeasonId("")
    setCustomDistance("")
    setCalendarOpen(false)
    setEntryStep("event")
    setError(null)
    setErrorField(null)
    unsafeDraft.current = false
    const plan = loadVersionedPlanBetaState()
    const usesRecord = plan?.version === 3 && plan.activePlan.sessions.some(session => session.prescription.kind === "PACE_TARGET"
      ? session.prescription.targetEventDistanceM === distance
      : session.prescription.kind === "RPE_TIME_RANGE"
      && session.prescription.catalogWorkout && (session.prescription.catalogWorkout.inputs.paceReferences?.some(reference =>
        (reference.eventDistanceM === 21097 ? 21097.5 : reference.eventDistanceM) === distance)
        || distance === 5000 && session.prescription.catalogWorkout.inputs.fiveK !== null))
    if (usesRecord) {
      const currentScope = localAccountScopeSnapshot()
      try {
        const preview = await prepareCurrentPaceUpdate(record)
        if (!localAccountScopeIsCurrent(currentScope)) return
        if (preview.kind === "ready" || preview.excluded?.some(row => row.reasonCode === "PROPOSAL_INVALID")) {
          setUpdateRecord(record)
          return
        }
      } catch {
        if (!localAccountScopeIsCurrent(currentScope)) return
        setStorageMessage("경기 기록은 저장했어요. 계획 변경안은 불러오지 못했어요. 저장한 기록에서 다시 확인할 수 있어요.")
        return
      }
    }
    onSaved?.()
  }

  const retryPending = async () => {
    if (!pendingRecord || saveLock.current) return
    saveLock.current = true; setSaving(true)
    const scope = localAccountScopeSnapshot()
    try {
      const current = await loadAccountAthleteRecords()
      if (scope && localAccountScopeIsCurrent(scope) && current.confirmed
        && current.records.some(record => JSON.stringify(record) === JSON.stringify(pendingRecord))) {
        if (!cacheConfirmedAthleteRecords(current.records, scope)) {
          setStorageMessage("계정 저장은 확인했지만 이 기기의 목록을 갱신하지 못했어요. 입력 내용은 그대로예요.")
          return
        }
        const saved = pendingRecord
        setPendingRecord(null); setStorageMessage("계정에 경기 기록을 저장했어요."); await finishSaved(saved)
      } else setStorageMessage("아직 계정 저장을 확인하지 못했어요. 전송 대기 내용은 보관돼 있어요.")
    } catch { setStorageMessage("연결을 확인하지 못했어요. 전송 대기 내용은 보관돼 있어요.") }
    finally { saveLock.current = false; setSaving(false) }
  }

  const currentDistanceLabel = distanceOption === "CUSTOM"
    ? `${customDistance || "입력한 거리"}m`
    : DISTANCE_OPTIONS.find(([value]) => value === distanceOption)?.[1] ?? "선택한 종목"
  const currentPurposeLabel = PURPOSE_OPTIONS.find(([value]) => value === purpose)?.[1] ?? "저장한 기록"
  const currentTimeSeconds = Number(minutes || "0") * 60 + Number(seconds || "0")
  const stepHeading = entryStep === "event"
    ? initialPurpose === "PERSONAL_BEST" ? "최고기록을 남겨요" : "내 경기 기록"
    : entryStep === "time" ? "기록 시간을 입력해 주세요"
    : purpose === "RACE_GOAL" ? "목표 기록을 확인해 주세요" : "달성일을 입력할까요?"

  return (
    <section className="athlete-records" aria-labelledby="athlete-records-title">
      <header className="athlete-records-header">
        <button className="plan-back" type="button" onClick={() => runDraftSafeNavigation(onBack, preserveMountedDraftsOnBack)}>
          <ArrowLeft aria-hidden="true" size={17} />
          {backLabel}
        </button>
        <div className="plan-eyebrow">내 경기 기록</div>
        <h1 id="athlete-records-title" ref={headingRef} tabIndex={-1}>{stepHeading}</h1>
      </header>

      {updateRecord && <PacePlanUpdateNotice record={updateRecord} explicitPaceBasis={explicitPaceBasis} onDone={() => { setUpdateRecord(null); setExplicitPaceBasis(false); onBack() }} />}
      {storageMessage && <p role="status">{storageMessage}</p>}
      {lastSavedRecord && !unsafeDraft.current && !updateRecord && navigation?.openPaceCalculator && <button type="button" className="athlete-record-next"
        onClick={() => navigation.openPaceCalculator?.({ record: lastSavedRecord })}>이 기록으로 페이스 보기<ArrowRight size={18} aria-hidden="true" /></button>}
      {pendingRecord && <button type="button" disabled={saving} onClick={() => void retryPending()}>계정 저장 다시 확인</button>}

      {updateRecord === null && <>
      <form ref={formRef} className="athlete-record-form" onSubmit={handleStepSubmit}>
        <fieldset disabled={saving || pendingRecord !== null} style={{ display: "contents" }}>
        {entryStep === "event" && <div className="athlete-record-step">
          <label>
            <span>종목</span>
            <select aria-label="종목 거리" value={distanceOption} onChange={(event) => setDistanceOption(event.target.value)}>
              {DISTANCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {distanceOption === "CUSTOM" && <label>
            <span>직접 입력 거리 (m)</span>
            <input aria-label="직접 입력 거리 (m)" {...fieldProps("distance")} inputMode="decimal" value={customDistance}
              onChange={(event) => setCustomDistance(event.target.value)} />
            {fieldError("distance")}
          </label>}
          <label>
            <span>기록 구분</span>
            <select aria-label="기록 역할" value={purpose} onChange={(event) => setPurpose(event.target.value as RecordPurpose)}>
              {PURPOSE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {purpose === "SEASON_BEST" && <label>
            <span>시즌 이름</span>
            <input aria-label="시즌 이름" {...fieldProps("season")} value={seasonId}
              onChange={(event) => setSeasonId(event.target.value)} />
            {fieldError("season")}
          </label>}
          <div className="athlete-record-step-actions athlete-record-step-actions--single">
            <button className="athlete-record-save" type="submit" disabled={saving || pendingRecord !== null}>시간 입력<ArrowRight aria-hidden="true" size={17} /></button>
          </div>
        </div>}
        {entryStep === "time" && <div className="athlete-record-step">
          <div className="athlete-record-time">
            <label>
              <span>분</span>
              <input aria-label="기록 분" {...fieldProps("minutes")} inputMode="numeric"
                placeholder={`예: ${RECORD_MINUTE_EXAMPLES[distanceOption] ?? "2"}`} value={minutes}
                onChange={(event) => setMinutes(event.target.value)} />
              {fieldError("minutes")}
            </label>
            <label>
              <span>초</span>
              <input aria-label="기록 초" {...fieldProps("seconds")} inputMode="decimal" placeholder="예: 08.5" value={seconds}
                onChange={(event) => setSeconds(event.target.value)} />
              {fieldError("seconds")}
            </label>
          </div>
          {/^(?:\d+)?$/.test(minutes.trim()) && /^(?:\d+(?:\.\d+)?)?$/.test(seconds.trim())
            && Number(seconds || "0") < 60 && currentTimeSeconds > 0 && <output className="athlete-record-preview" aria-label="저장할 기록 미리보기">
              {currentDistanceLabel} · {paceClock(currentTimeSeconds)}
              <small>{currentPurposeLabel}{purpose === "RACE_GOAL" ? " · 아직 달성하지 않은 목표" : " · 입력한 기록"}</small>
            </output>}
          {error !== null && errorField === null && <p className="athlete-record-error" role="alert">{error}</p>}
          <div className="athlete-record-step-actions">
            <button className="athlete-record-step-back" type="button" onClick={() => { setError(null); setErrorField(null); setEntryStep("event") }}><ArrowLeft aria-hidden="true" size={17} />이전</button>
            <button className="athlete-record-save" type="submit" disabled={saving || pendingRecord !== null}>
              {purpose === "RACE_GOAL" ? "목표 확인" : "날짜 확인"}<ArrowRight aria-hidden="true" size={17} />
            </button>
          </div>
        </div>}
        {entryStep === "date" && <div className="athlete-record-step">
          {purpose !== "RACE_GOAL" ? <label>
            <span>달성일 (선택) · 모르면 비워 두세요</span>
            <span className="athlete-record-date">
              <input aria-label="달성일" {...fieldProps("date")} inputMode="numeric" placeholder="YYYY-MM-DD" value={achievedOn}
                onChange={(event) => setAchievedOn(event.target.value)} />
              <button type="button" aria-label="달력으로 날짜 선택" aria-expanded={calendarOpen}
                onClick={() => setCalendarOpen(value => !value)}><CalendarDays size={18} aria-hidden="true" /></button>
            </span>
            {calendarOpen && <input type="date" aria-label="달성일 달력" value={/^\d{4}-\d{2}-\d{2}$/.test(achievedOn) ? achievedOn : ""}
              onChange={event => { setAchievedOn(event.target.value); setCalendarOpen(false) }} />}
            {fieldError("date")}
          </label> : <p className="athlete-record-goal-note">목표 기록에는 달성일을 저장하지 않아요. 현재 경기력 기록과 구분해 보관해요.</p>}
          <output className="athlete-record-preview" aria-label="저장할 기록 미리보기">
            {currentDistanceLabel} · {paceClock(currentTimeSeconds)}
            <small>{currentPurposeLabel}{purpose === "RACE_GOAL" ? " · 아직 달성하지 않은 목표" : ` · ${achievedOn || "달성일 미입력"}`}</small>
          </output>
          <InfoDisclosure className="athlete-record-help" title="기록은 어떻게 사용하나요?">
            <p>선수 직접 입력 · 아직 별도 검증되지 않음</p>
            <p>개인 최고는 입력한 기록 기준이에요. 목표 기록과 실제 경기 기록은 따로 보관해요.</p>
            <p>날짜가 없으면 최근 12개월 최고 계산에는 넣지 않아요. 과거 계획의 목표 초는 바뀌지 않아요.</p>
          </InfoDisclosure>
          {error !== null && errorField === null && <p className="athlete-record-error" role="alert">{error}</p>}
          <div className="athlete-record-step-actions">
            <button className="athlete-record-step-back" type="button" onClick={() => { setError(null); setErrorField(null); setEntryStep("time") }}><ArrowLeft aria-hidden="true" size={17} />이전</button>
            <button className="athlete-record-save" type="submit" disabled={saving || pendingRecord !== null}><Save aria-hidden="true" size={17} />기록 저장</button>
          </div>
        </div>}
        </fieldset>
      </form>

      <section
        className="athlete-record-list"
        aria-label="저장한 경기 기록"
      >
        <div className="athlete-record-list-heading">
          <h2>저장한 기록</h2>
          <span>{records.length}개</span>
        </div>
        {records.length === 0 ? (
          <p className="athlete-record-empty">저장한 기록이 아직 없어요.</p>
        ) : (
          <ol>
            {records.map((record) => (
              <AthleteRecordRow key={record.id} record={record}
                onUsePace={!saving && !pendingRecord && loadVersionedPlanBetaState()?.version === 3 && isEligiblePaceRecordCurrent(record)
                  ? () => { if (isEligiblePaceRecordCurrent(record)) { setExplicitPaceBasis(true); setUpdateRecord(record) } } : undefined} />
            ))}
          </ol>
        )}
      </section>
      </>}
    </section>
  )
}

function newLocalRecordId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
