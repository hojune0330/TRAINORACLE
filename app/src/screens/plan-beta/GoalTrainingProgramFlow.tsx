import React from "react"
import type { ExperienceBand, PlanSession, TrainingTimePreference } from "@impl/plan-generator/types"
import { ArrowLeft } from "lucide-react"
import { GoalProgramEntry, type GoalProgramPreviewRequest } from "../../components/instant-plan/GoalProgramEntry"
import { resolveGoalProgramWindow, tenKGoalPaceLabel } from "../../domain/goal-program-calendar"
import { createGoalTrainingProgramPreview, generateGoalTrainingProgram, projectGoalTrainingProgramFrames, goalTrainingProgramDurationReview,
  type GoalTrainingProgramPreview } from "../../domain/goal-training-program"
import { applyGoalTrainingProgramCycle, archiveGoalTrainingProgramCycle, exportGoalTrainingProgramJSON,
  readGoalTrainingProgram, restoreGoalTrainingProgramJSON, saveGoalTrainingProgram,
  goalTrainingProgramStorageStatus, refreshGoalTrainingProgram,
  goalTrainingProgramAccountSnapshot, acceptRemoteGoalTrainingProgram, exportGoalTrainingProgramConflictJSON,
  subscribeGoalTrainingProgramChanges } from "../../domain/goal-training-program-store"
import type { AccountGoalProgramSnapshot } from "../../domain/account/account-goal-program-service"
import { evaluatePlanSafety } from "../../domain/plan-beta-flow"
import { todayISO } from "../../domain/journal-store"
import { localAccountScopeIsCurrent, localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { localJournalScopeGeneration } from "../../domain/account/local-journal-ownership"
import { useTaskFlowBack } from "../../hooks/useTaskFlowBack"
import { usePlanDraftNavigationGuard } from "./usePlanDraftNavigationGuard"
import { EXPERIENCE_LABELS, formatTrainingSeconds } from "./labels"
import { GoalProgramPreviewOverview } from "./GoalProgramPreviewOverview"
import { PlanSchedulePreview } from "./PlanSchedulePreview"
import "./goal-training-program.css"

const EXPERIENCE = ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"] as const
type Stage = "entry" | "experience" | "basis" | "result"
type Cycle = 1 | 2 | 3

function failureMessage(code: string): string {
  if (code === "ACCOUNT_STORAGE_UNSUPPORTED" || /UNSUPPORTED|UPGRADE_REQUIRED/u.test(code)) return "계정 저장이 아직 지원되지 않아요. 훈련표는 미리보기로 볼 수 있어요."
  if (/PENDING/u.test(code)) return "동기화 대기 중이에요. 입력은 유지했어요. 연결된 뒤 저장 상태를 다시 확인해 주세요."
  if (/AUTH_REQUIRED/u.test(code)) return "로그인이 만료됐어요. 다시 로그인한 뒤 저장 상태를 확인해 주세요."
  if (/LOADING/u.test(code)) return "저장된 훈련표를 확인하는 중이에요. 잠시 후 다시 시도해 주세요."
  if (code === "EXISTING_PROGRAM_REQUIRES_REVIEW") return "다른 훈련표가 이미 보관돼 있어요. 먼저 현재 훈련표를 파일로 보관해 주세요. 파일 불러오기로 기존 훈련표를 덮어쓰지는 않아요."
  if (/HISTORY_CAPACITY/u.test(code)) return "이 기기의 훈련표 보관 한도에 도달했어요. 기존 자료를 지우지 않고 새 저장을 멈췄어요."
  if (/BACKUP/u.test(code)) return "이 훈련표 파일을 확인하지 못했어요. 다른 형식이거나 수정된 파일인지 확인해 주세요."
  if (code === "DURATION_CONFIRMATION_REQUIRED") return "준비·회복·정리를 포함한 전체 훈련시간을 먼저 확인해 주세요."
  if (code === "GOAL_RACE_PACE_UNAVAILABLE") return "이 조건에 맞는 목표 속도 훈련을 찾지 못했어요. 시간 기준 훈련표를 보거나 조건을 바꿔 주세요."
  if (/STALE|CHANGED|CONFLICT/u.test(code)) return "다른 화면에서 계획이 바뀌었어요. 저장된 내용을 다시 확인한 뒤 시도해 주세요."
  if (/SAFETY|RISK|BODY_CONFIRMATION|PAIN/u.test(code)) return "몸 상태 확인이 필요해 계획을 시작하지 않았어요. 훈련표는 미리보기로만 확인해 주세요."
  if (/ACTIVE|CURRENT|PREDECESSOR/u.test(code)) return "진행 중인 계획을 먼저 확인해 주세요. 기존 계획을 덮어쓰지 않았어요."
  if (/DATE|PAST|EARLY/u.test(code)) return "훈련표 날짜를 다시 확인해 주세요. 지나간 훈련을 오늘로 몰아넣지 않았어요."
  return "처리를 마치지 못했어요. 입력을 유지했으니 저장 상태를 다시 확인해 주세요."
}

/** One month is a wrapper around three source frames, not a second execution engine. */
export function GoalTrainingProgramFlow({ onClose, onOpenActive }: {
  onClose: () => void
  onOpenActive: () => void
}) {
  const [read, setRead] = React.useState(readGoalTrainingProgram)
  const [storageStatus, setStorageStatus] = React.useState(goalTrainingProgramStorageStatus)
  const [stage, setStage] = React.useState<Stage>(() => read.kind === "missing" || read.kind === "account_unsupported" ? "entry" : "result")
  const [request, setRequest] = React.useState<GoalProgramPreviewRequest>()
  const [experience, setExperience] = React.useState<ExperienceBand>()
  const [days, setDays] = React.useState<3 | 4 | 5 | 6>(3)
  const [editingSchedule, setEditingSchedule] = React.useState(false)
  const [time, setTime] = React.useState<TrainingTimePreference>("VARIES")
  const [goalPaceConfirmed, setGoalPaceConfirmed] = React.useState(false)
  const [longerDurationConfirmed, setLongerDurationConfirmed] = React.useState(false)
  const [preview, setPreview] = React.useState<GoalTrainingProgramPreview | null>(null)
  const [entryDirty, setEntryDirty] = React.useState(false)
  const [safetyFor, setSafetyFor] = React.useState<"new" | Cycle | null>(null)
  const [reviewOnly, setReviewOnly] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [ownBackup, setOwnBackup] = React.useState(false)
  const [archiveReview, setArchiveReview] = React.useState(false)
  const [replaceConfirmed, setReplaceConfirmed] = React.useState(false)
  const [dateExpired, setDateExpired] = React.useState(false)
  const [conflictReview, setConflictReview] = React.useState<AccountGoalProgramSnapshot | null>(null)
  const [expiredPendingReview, setExpiredPendingReview] = React.useState<AccountGoalProgramSnapshot | null>(null)
  const scope = React.useRef({ owner: localAccountScopeSnapshot(), generation: localJournalScopeGeneration() })
  const pending = React.useRef(false)
  const mounted = React.useRef(true)
  const previewRef = React.useRef(preview)
  previewRef.current = preview
  const entryInProgress = React.useRef(false)
  entryInProgress.current = entryDirty || request !== undefined || preview !== null
  const heading = React.useRef<HTMLHeadingElement>(null)
  const safetyHeading = React.useRef<HTMLHeadingElement>(null)
  const programSource = preview ?? (read.kind === "loaded" ? read.document.program : undefined)
  const durationReview = React.useMemo(() => programSource ? goalTrainingProgramDurationReview(programSource) : null, [programSource])
  const current = () => mounted.current && localAccountScopeIsCurrent(scope.current.owner)
    && scope.current.generation === localJournalScopeGeneration()
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const syncRead = () => {
    if (!current()) return
    const next = readGoalTrainingProgram()
    setRead(next); setStorageStatus(goalTrainingProgramStorageStatus())
    if (next.kind === "loaded" && !entryInProgress.current) setStage("result")
  }
  React.useEffect(() => {
    if (goalTrainingProgramStorageStatus() !== "DEVICE") void refreshGoalTrainingProgram().then(syncRead).catch(syncRead)
  }, [])
  React.useEffect(() => subscribeGoalTrainingProgramChanges(() => {
    if (!current() || pending.current) return
    syncRead()
    // A confirmation belongs to the version the person actually reviewed.
    // Do not silently carry it over to a program changed in another tab/device.
    setReplaceConfirmed(false)
    setSafetyFor(null)
    setArchiveReview(false)
    setConflictReview(null)
    setExpiredPendingReview(null)
  }), [])
  React.useLayoutEffect(() => {
    if (safetyFor !== null) safetyHeading.current?.focus()
    else if (stage !== "entry") heading.current?.focus()
  }, [stage, safetyFor])
  const dirty = preview !== null || stage !== "result" && (entryDirty || request !== undefined)
  usePlanDraftNavigationGuard(dirty, "아직 저장하지 않은 훈련표가 있어요. 만들기를 그만두고 이동할까요?", busy)

  const back = () => {
    if (pending.current) return
    if (safetyFor !== null) { setSafetyFor(null); return }
    if (archiveReview) { setArchiveReview(false); return }
    if (stage === "basis") { setStage("experience"); return }
    if (stage === "experience") { setStage("entry"); return }
    if (preview) { setPreview(null); setStage("basis"); return }
    onClose()
  }
  useTaskFlowBack({ enabled: stage !== "entry", busy, onBack: back })

  const run = async (operation: () => Promise<void>) => {
    if (pending.current || !current()) return
    pending.current = true; setBusy(true); setError(null); setNotice(null)
    try { await operation() }
    catch { if (current()) { setRead(readGoalTrainingProgram()); setError("처리를 마치지 못했어요. 저장 상태를 다시 확인해 주세요.") } }
    finally { pending.current = false; if (current()) { syncRead(); setBusy(false) } }
  }

  const makePreview = (selectedExperience = experience, selectedGoalPace = goalPaceConfirmed, selectedRequest = request) => {
    if (!selectedRequest || !selectedExperience || pending.current) return
    const result = createGoalTrainingProgramPreview({ goalMinutes: selectedRequest.goalMinutes,
      dateChoice: selectedRequest.window.deadline ? { kind: "DEADLINE", deadline: selectedRequest.window.deadline }
        : { kind: "START", startDate: selectedRequest.window.startDate },
      today: todayISO(), generatedAt: new Date().toISOString(), experienceBand: selectedExperience,
      availableDayCount: days, trainingTimePreference: time, goalPaceConfirmed: selectedGoalPace })
    setDateExpired(result.kind === "start-in-past")
    if (result.kind !== "preview") {
      setError(result.kind === "start-in-past" ? "시작일이 지났어요. 날짜를 바꾸거나 오늘부터 다시 볼 수 있어요."
        : failureMessage("code" in result ? result.code : "INVALID_DATE")); return
    }
    setPreview(result.preview); setEditingSchedule(false); setLongerDurationConfirmed(false); setStage("result"); setSafetyFor(null); setReviewOnly(false); setError(null)
  }

  const start = () => { void run(async () => {
    const safety = evaluatePlanSafety("NO_KNOWN_RISK")
    if (safety.kind !== "passed") { setError(failureMessage("SAFETY_REVIEW")); setSafetyFor(null); setReviewOnly(true); return }
    let document = read.kind === "loaded" ? read.document : null
    let cycle: Cycle
    if (safetyFor === "new" && preview) {
      if (expiredPendingReview && !reviewedPendingCurrent()) {
        setError("확인한 초안이 바뀌었어요. 저장 상태를 다시 확인해 주세요."); return
      }
      const selected = preview
      const result = generateGoalTrainingProgram({ goalMinutes: selected.goalMinutes, dateChoice: selected.dateChoice,
        today: todayISO(), generatedAt: selected.generatedAt, ...selected.inputs, longerDurationConfirmed, safetyGate: safety.gate })
      if (result.kind !== "ready") { setError(failureMessage("code" in result ? result.code : "INVALID_DATE")); return }
      const saved = await saveGoalTrainingProgram(result.program, { expectedRevision: document?.revision ?? null,
        currentCheck: "NO_KNOWN_RISK", replaceExisting: replaceConfirmed,
        ...(expiredPendingReview ? { replaceExpiredPending: true as const, expectedPendingReview: structuredClone(expiredPendingReview) } : {}),
        freshPreview: () => current() && previewRef.current === selected })
      if (!current()) return
      if (saved.kind !== "saved") { setError(failureMessage(saved.code)); return }
      document = saved.document; cycle = 1
      setPreview(null); setEntryDirty(false); setRequest(undefined); setReplaceConfirmed(false); setExpiredPendingReview(null); setRead(readGoalTrainingProgram())
    } else if (typeof safetyFor === "number" && document) cycle = safetyFor
    else return
    if (!document) return
    const applied = await applyGoalTrainingProgramCycle({ programId: document.program.programId,
      expectedRevision: document.revision, cycle, confirmsNoKnownRisk: true, freshReview: current })
    if (!current()) return
    setRead(readGoalTrainingProgram()); setSafetyFor(null)
    if (applied.kind !== "applied") { setError(failureMessage(applied.code)); setNotice(storageStatus === "DEVICE"
      ? "한 달 훈련표는 보관했지만 이번 9.5일 훈련은 시작하지 않았어요."
      : "한 달 훈련표는 보관했어요. 이번 훈련의 연결 상태는 다시 확인해 주세요."); return }
    setReviewOnly(false)
    setNotice(`${cycle}차 9.5일 훈련을 시작했어요.`)
  }) }

  const downloadBackup = (raw: string, conflict = false) => {
    let url: string | undefined
    try {
      url = URL.createObjectURL(new Blob([raw], { type: "application/json" }))
      const link = document.createElement("a")
      link.href = url; link.download = `trainoracle-goal-program${conflict ? "-draft" : ""}-${todayISO()}.json`; link.click()
      setNotice("훈련표 파일을 내려받았어요. 개인 파일로 보관해 주세요.")
    } catch { setError("훈련표 파일을 준비하지 못했어요. 저장된 계획은 그대로 있어요.") }
    finally { if (url) { const captured = url; window.setTimeout(() => URL.revokeObjectURL(captured), 1000) } }
  }
  const exportFile = () => {
    try { downloadBackup(exportGoalTrainingProgramJSON()) }
    catch { setError("훈련표 파일을 준비하지 못했어요. 저장된 계획은 그대로 있어요.") }
  }

  const importFile = (file?: File) => { if (!file || !ownBackup) return; void run(async () => {
    if (file.size > 10_000_000) { setError("10MB 이하의 훈련표 파일을 골라 주세요."); return }
    const raw = await file.text()
    if (!current()) return
    const restored = await restoreGoalTrainingProgramJSON(raw, { expectedRevision: read.kind === "loaded" ? read.document.revision : null,
      confirmsOwnFile: true, isCurrentRequest: current })
    if (!current()) return
    if (restored.kind !== "restored") { setError(failureMessage(restored.code)); return }
    setRead(readGoalTrainingProgram()); setPreview(null); setRequest(undefined); setEntryDirty(false); setStage("result")
    setNotice("훈련표를 복원했어요. 진행 중인 계획은 바꾸지 않았어요.")
  }) }

  const writable = storageStatus === "DEVICE" ? scope.current.owner === null : storageStatus === "READY" || storageStatus === "EMPTY"
  const accountSnapshot = storageStatus === "PENDING" ? goalTrainingProgramAccountSnapshot() : null
  const expiredPending = accountSnapshot?.status === "PENDING" && accountSnapshot.goalStartDateReviewRequired === true && accountSnapshot.pendingDocument
    && accountSnapshot.pendingDocument.program.window.startDate < todayISO() ? accountSnapshot : null
  const reviewedPendingCurrent = () => {
    if (!expiredPendingReview) return false
    const latest = goalTrainingProgramAccountSnapshot()
    return current() && !!expiredPendingReview && latest?.status === "PENDING" && latest.goalStartDateReviewRequired === true
      && !!latest.pendingDocument && latest.pendingDocument.program.window.startDate < todayISO()
      && JSON.stringify(latest) === JSON.stringify(expiredPendingReview)
  }
  const recoveringExpiredPending = reviewedPendingCurrent()
  const newProgramWritable = writable || recoveringExpiredPending
  const accountStorageLabel = storageStatus === "DEVICE" && scope.current.owner !== null
    ? "계정 저장이 아직 지원되지 않아요. 훈련표는 미리보기로 볼 수 있어요."
    : ({ LOADING: "계정의 훈련표를 확인하고 있어요.", PENDING: "동기화 대기 중",
    CONFLICT: "다른 기기의 변경과 겹쳤어요. 두 내용을 보존한 채 새 저장을 멈췄어요.",
    FAILED: "계정 저장을 확인하지 못했어요. 입력은 유지했어요.", AUTH_REQUIRED: "다시 로그인한 뒤 저장 상태를 확인해 주세요.",
    UNSUPPORTED: "계정 저장이 아직 지원되지 않아요. 훈련표는 미리보기로 볼 수 있어요.",
    UPGRADE_REQUIRED: "더 최신 버전에서 저장한 훈련표예요. 앱을 업데이트한 뒤 다시 열어 주세요." } as Record<string, string>)[storageStatus]
  const storageFeedback = accountStorageLabel && <div className="goal-program__storage">
    <p role="status">{accountStorageLabel}</p>
    {expiredPending && <section aria-label="시작일이 지난 초안 확인">
      <p>초안의 시작일이 지났어요. 날짜를 다시 고르면 이전 초안도 보관해요.</p>
      <p>{expiredPending.pendingDocument!.program.window.startDate} 시작 · 10km {expiredPending.pendingDocument!.program.goalMinutes}분 목표</p>
      <button type="button" disabled={busy} onClick={() => { void run(async () => {
        const raw = await exportGoalTrainingProgramConflictJSON(expiredPending)
        if (current()) downloadBackup(raw, true)
      }) }}>대기 중 초안 파일로 보관</button>
      {!recoveringExpiredPending && <button type="button" disabled={busy} onClick={() => {
        setExpiredPendingReview(structuredClone(expiredPending))
        setRequest({ goalMinutes: expiredPending.pendingDocument!.program.goalMinutes, window: structuredClone(expiredPending.pendingDocument!.program.window) })
        setPreview(null); setEntryDirty(false); setReplaceConfirmed(false); setSafetyFor(null); setConflictReview(null)
        setDateExpired(false); setStage("entry"); setError(null); setNotice(null)
      }}>날짜를 다시 골라 보관하기</button>}
      {recoveringExpiredPending && <p>새 날짜와 몸 상태를 확인한 뒤 저장해요. 확인하기 전까지 기존 훈련표와 초안은 그대로 있어요.</p>}
    </section>}
    {!["LOADING", "AUTH_REQUIRED", "UPGRADE_REQUIRED"].includes(storageStatus) && <button type="button" disabled={busy} onClick={() => {
      void run(async () => { await refreshGoalTrainingProgram() })
    }}>저장 상태 다시 확인</button>}
    {storageStatus === "CONFLICT" && <>
      {!conflictReview ? <button type="button" disabled={busy} onClick={() => setConflictReview(goalTrainingProgramAccountSnapshot())}>두 훈련표 확인</button>
        : <section aria-label="겹친 훈련표 확인">
          <h3>어떤 훈련표를 사용할까요?</h3>
          <p>계정: {conflictReview.document ? `10km ${conflictReview.document.program.goalMinutes}분 · ${conflictReview.document.program.window.startDate} 시작` : "저장된 훈련표 없음"}</p>
          <p>이 기기의 초안: {conflictReview.pendingDocument ? `10km ${conflictReview.pendingDocument.program.goalMinutes}분 · ${conflictReview.pendingDocument.program.window.startDate} 시작` : "확인하지 못함"}</p>
          <p>현재 진행 중인 훈련은 바꾸지 않아요. 초안은 파일로 따로 보관할 수 있어요.</p>
          <button type="button" disabled={busy || !conflictReview.pendingDocument} onClick={() => { void run(async () => {
            const raw = await exportGoalTrainingProgramConflictJSON(conflictReview)
            if (current()) downloadBackup(raw, true)
          }) }}>이 기기 초안 파일로 보관</button>
          <button type="button" disabled={busy} onClick={() => { void run(async () => {
            const accepted = await acceptRemoteGoalTrainingProgram(conflictReview)
            if (!current()) return
            if (accepted) {
              const next = readGoalTrainingProgram()
              setRead(next); setPreview(null); setRequest(undefined); setEntryDirty(false)
              setSafetyFor(null); setReplaceConfirmed(false); setArchiveReview(false); setExpiredPendingReview(null)
              setStage(next.kind === "missing" ? "entry" : "result")
              setConflictReview(null); setNotice("계정 훈련표를 불러왔어요. 진행 중인 훈련은 바꾸지 않았어요.")
            } else setError("확인하는 동안 저장 상태가 바뀌었어요. 다시 확인해 주세요.")
          }) }}>계정 훈련표 사용</button>
          <button type="button" disabled={busy} onClick={() => setConflictReview(null)}>결정하지 않고 닫기</button>
        </section>}
    </>}
  </div>
  const backupTools = <details className="goal-program__details"><summary>훈련표 파일 보관·복원</summary>
    {read.kind === "loaded" && <button type="button" disabled={busy || !writable} onClick={exportFile}>훈련표 파일 내려받기</button>}
    <label className="goal-program__check"><input type="checkbox" checked={ownBackup} disabled={busy}
      onChange={event => setOwnBackup(event.target.checked)} />내가 보관한 훈련표 파일이에요</label>
    <label className="goal-program__file">훈련표 파일 불러오기<input type="file" accept="application/json,.json" disabled={!ownBackup || busy || !writable}
      onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; importFile(file) }} /></label>
    <p>같은 형식의 훈련표만 복원해요. 다른 훈련표가 이미 보관돼 있으면 덮어쓰지 않아요.</p>
  </details>

  if (stage === "entry") return <section className="goal-program" aria-label="한 달 훈련표 만들기">
    <GoalProgramEntry key={expiredPendingReview ? `pending-date:${expiredPendingReview.sequence}` : "ordinary"}
      today={todayISO()} readToday={todayISO} initialRequest={request} disabled={busy}
      onDraftChange={setEntryDirty} onBack={() => {
        if (dirty && !window.confirm("입력한 목표와 날짜를 지우고 나갈까요?")) return
        if (read.kind === "loaded") {
          setPreview(null); setRequest(undefined); setEntryDirty(false); setReplaceConfirmed(false)
          setSafetyFor(null); setExpiredPendingReview(null); setError(null); setStage("result")
        } else onClose()
      }}
      onPreview={value => { setRequest(value); setEditingSchedule(false); setStage("experience"); setError(null); setDateExpired(false) }} />
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{storageFeedback}{backupTools}
  </section>

  if (stage === "experience") return <section className="goal-program">
    <button type="button" className="plan-text-action" onClick={back}><ArrowLeft size={18} aria-hidden="true" />목표·날짜 바꾸기</button>
    <h2 tabIndex={-1} ref={heading}>{editingSchedule ? "얼마나 자주 달릴까요?" : "달리기 경험은 어느 정도인가요?"}</h2>
    <div className="app-choice-group goal-program__choices" role="group" aria-label="달리기 경험">
      {EXPERIENCE.map(value => <button type="button" className="app-choice-control app-choice-control--answer" key={value}
        aria-pressed={experience === value} onClick={() => { setExperience(value); if (!editingSchedule) setStage("basis"); setError(null) }}>{EXPERIENCE_LABELS[value].title}</button>)}
    </div>
    <details className="goal-program__details" open={editingSchedule || undefined}><summary>훈련 횟수·시간대 바꾸기</summary>
      <label>9.5일마다 훈련할 날<select value={days} onChange={event => setDays(Number(event.target.value) as 3 | 4 | 5 | 6)}>
        {[3, 4, 5, 6].map(value => <option key={value} value={value}>{value}일 · 나머지는 휴식</option>)}</select></label>
      <label>주로 훈련할 시간<select value={time} onChange={event => setTime(event.target.value as TrainingTimePreference)}>
        <option value="VARIES">날마다 달라요</option><option value="MORNING">오전</option><option value="EVENING">오후·저녁</option>
      </select></label>
    </details>
    {editingSchedule && <><p>9.5일마다 {days}일씩, 한 달에 {days * 3}회 달리는 설정이에요. 목표 시간과 날짜는 유지해요.</p>
      <button type="button" className="instant-plan__button" disabled={busy || !experience} onClick={() => makePreview()}>이 조건으로 다시 보기</button></>}
    {error && <p role="alert">{error}</p>}
  </section>

  if (stage === "basis") return <section className="goal-program">
    <button type="button" className="plan-text-action" disabled={busy} onClick={back}><ArrowLeft size={18} aria-hidden="true" />경험·훈련 횟수 바꾸기</button>
    <h2 tabIndex={-1} ref={heading}>어떤 방식으로 훈련할까요?</h2>
    <div className="app-choice-group goal-program__choices" role="group" aria-label="훈련 방식">
      <button type="button" className="app-choice-control app-choice-control--answer" disabled={busy}
        onClick={() => { setGoalPaceConfirmed(true); makePreview(experience, true) }}>
        <strong>목표 속도로 연습</strong>
        <span>{request && `1km에 ${tenKGoalPaceLabel(request.goalMinutes).replace("/km", "")}`} · 속도가 적힌 구간에서만 따라요</span>
      </button>
      <button type="button" className="app-choice-control app-choice-control--answer" disabled={busy}
        onClick={() => { setGoalPaceConfirmed(false); makePreview(experience, false) }}>
        <strong>시간 기준으로 훈련</strong>
        <span>속도 대신 시간·힘든 정도를 따라요</span>
      </button>
    </div>
    <p className="goal-program__muted">목표 속도는 현재 실력을 계산한 값이 아니에요.</p>
    {error && <p role="alert">{error}</p>}
    {dateExpired && <button type="button" onClick={() => {
      if (!request) return
      const window = resolveGoalProgramWindow({ kind: "START", startDate: todayISO() }, todayISO())
      if (window.kind !== "ready") return
      const next = { goalMinutes: request.goalMinutes, window: window.window }
      setRequest(next); makePreview(experience, goalPaceConfirmed, next)
    }}>오늘부터 약 한 달 계획 보기</button>}
    {dateExpired && request?.window.deadline && <p>대회 날짜에 맞추는 대신 오늘부터 9.5일 훈련 세 번을 배치해요.</p>}
  </section>

  const stored = read.kind === "loaded" ? read.document : null
  const source = programSource
  let sourceDays = source?.days ?? []
  let projectionInvalid = false
  if (!preview && stored) {
    const projection = projectGoalTrainingProgramFrames(stored.program, stored.program.frames.map(frame => ({ ...frame,
      plan: stored.cycles.find(cycle => cycle.cycle === frame.cycle)?.latestPlan ?? frame.plan })))
    if (projection.kind === "ready") sourceDays = projection.days
    else { sourceDays = []; projectionInvalid = true }
  }
  const sessions: readonly PlanSession[] = sourceDays.map((day, index) => ({ ...day.session, day: index + 1 }))
  const workouts = sourceDays.filter(day => day.session.role !== "REST").length
  const activeCycle = stored?.application?.currentCycleIndex
  const canUseActive = read.kind === "loaded" && read.currentCycleStatus === "CURRENT"
  const annotations: Record<string, string> = {}
  source?.frames.forEach(frame => {
    const start = source.window.halfDays[frame.halfDayOffset]
    if (start) annotations[start.date] = `${frame.cycle}차 시작${start.slot === "PM" ? " · 오후" : ""}`
  })
  if (source?.window.deadline) annotations[source.window.deadline] = "대회 날짜"

  return <section className="goal-program" aria-label="한 달 훈련표" aria-busy={busy}>
    <button type="button" className="plan-text-action" disabled={busy} onClick={back}><ArrowLeft size={18} aria-hidden="true" />{preview ? "조건 바꾸기" : "뒤로"}</button>
    <h2 tabIndex={-1} ref={heading}>{source ? `10km ${source.goalMinutes}분 목표` : "한 달 훈련표"}</h2>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{storageFeedback}
    {!source ? <>
      <p role="alert">저장된 훈련표를 읽지 못했어요. 기존 자료를 지우거나 덮어쓰지 않았어요.</p>
      <button type="button" onClick={() => {
        const next = readGoalTrainingProgram(); setRead(next)
        if (next.kind === "missing" || next.kind === "account_unsupported") setStage("entry")
      }}>다시 확인</button>
    </> : <>
      {preview ? <GoalProgramPreviewOverview source={preview} disabled={busy || safetyFor !== null}
        onEditSchedule={() => { setPreview(null); setEditingSchedule(true); setStage("experience"); setLongerDurationConfirmed(false); setError(null) }}
        onEditBasis={() => { setPreview(null); setStage("basis"); setLongerDurationConfirmed(false); setError(null) }} /> : <>
      <p className="goal-program__summary">{source.window.startDate} ~ {source.window.endDate}<br />{!projectionInvalid && <>훈련 {workouts}회 · 휴식 {29 - workouts}일 · 하루 최대 1회</>}</p>
      <p>한 달 기본 훈련 · 9.5일 × 3</p>
      {source.window.deadline && <p>대회 날짜 · {source.window.deadline}<br />대회 전 훈련량은 자동으로 줄이지 않아요.</p>}
      <p className="goal-program__muted">{preview ? "미리보기 · 아직 시작하지 않았어요" : storageStatus === "DEVICE" ? "이 기기에 보관된 훈련표" : "계정에서 확인한 훈련표"}</p>
      <p>{source.inputs.goalPaceConfirmed ? `목표 속도 · 1km에 ${tenKGoalPaceLabel(source.goalMinutes).replace("/km", "")} · 속도가 적힌 구간에서만 따라요` : "시간 기준 훈련표 · 각 날짜의 시간·힘든 정도를 따라요."}</p>
      <p className="goal-program__muted">목표 기록은 현재 실력이나 달성 보장이 아니에요.</p>
      </>}
      {projectionInvalid && <p role="alert">수정된 훈련표의 날짜를 확인하지 못했어요. 원본으로 바꿔 표시하지 않았어요. 현재 계획을 확인해 주세요.</p>}
      {reviewOnly && <p role="alert">몸 상태 확인 필요 · 이 훈련표로 훈련을 시작하지 마세요.</p>}
      {safetyFor !== null ? <section className="goal-program__safety" aria-label="시작 전 몸 상태 확인">
        <h3 ref={safetyHeading} tabIndex={-1}>지금 몸 상태는 어떤가요?</h3>
        <div className="app-choice-group goal-program__choices">
          <button type="button" className="app-choice-control" disabled={busy || !(safetyFor === "new" ? newProgramWritable : writable)} onClick={start}>{busy ? "시작하는 중…" : "통증 없고 평소와 같아요 · 시작"}</button>
          <button type="button" className="app-choice-control" disabled={busy} onClick={() => { setReviewOnly(true); setSafetyFor(null) }}>통증·몸 이상이 있거나 잘 모르겠어요</button>
        </div><button type="button" disabled={busy} onClick={() => setSafetyFor(null)}>미리보기로 돌아가기</button>
      </section> : preview ? <>
        {durationReview?.required && durationReview.maximumSeconds !== null && <label className="goal-program__check">
          <input type="checkbox" checked={longerDurationConfirmed} disabled={busy}
            onChange={event => setLongerDurationConfirmed(event.target.checked)} />
          최대 {formatTrainingSeconds(durationReview.maximumSeconds)} 훈련시간을 확인했어요
        </label>}
        {stored && <label className="goal-program__check"><input type="checkbox" checked={replaceConfirmed}
          onChange={event => setReplaceConfirmed(event.target.checked)} />이전 훈련표를 보관하고 새 훈련표로 바꿀게요</label>}
        <button type="button" className="instant-plan__button" disabled={busy || !newProgramWritable || !!stored && !replaceConfirmed
          || durationReview?.required && !longerDurationConfirmed}
          onClick={() => setSafetyFor("new")}>{reviewOnly ? "몸 상태 다시 확인" : "이 계획 시작"}</button>
      </> : <>
        {canUseActive && <button type="button" className="instant-plan__button" disabled={busy} onClick={onOpenActive}>이번 9.5일 보기·수정</button>}
        {read.kind === "loaded" && read.currentCycleStatus === "PAUSED" && <p role="status">복원한 훈련표예요. 몸 상태를 확인한 뒤 진행하던 9.5일 훈련을 다시 연결할 수 있어요.</p>}
        {read.kind === "loaded" && ["DETACHED", "UNAVAILABLE"].includes(read.currentCycleStatus) && <p role="alert">현재 계획과 연결되지 않은 훈련표예요. 다른 계획을 덮어쓰지 않았어요.</p>}
        <div className="goal-program__cycles" role="group" aria-label="9.5일 마이크로사이클 세 번">
          {stored?.cycles.map(cycle => <div key={cycle.cycle}>
            <strong>{cycle.cycle}차 · 9.5일</strong>
            <span>{stored.program.frames[cycle.cycle - 1]?.plan.intake.startDate?.slice(5).replace("-", "/")}부터</span>
            <span>{cycle.status === "CURRENT" ? canUseActive ? "진행 중" : "연결 대기" : cycle.status === "ENDED" ? "마침" : "시작 전"}</span>
            {cycle.status === "CURRENT" && read.kind === "loaded" && read.currentCycleStatus === "PAUSED" && <button type="button"
              disabled={busy || !writable || projectionInvalid} onClick={() => setSafetyFor(cycle.cycle)}>이번 훈련 다시 연결</button>}
            {cycle.status === "PENDING" && (cycle.cycle === 1 || stored.cycles[cycle.cycle - 2]?.status === "ENDED") && <button type="button" disabled={busy || !writable
              || projectionInvalid
              }
              onClick={() => setSafetyFor(cycle.cycle)}>{cycle.cycle}차 훈련 시작</button>}
          </div>)}
        </div>
        {canUseActive && <section className="goal-program__actions" aria-label="이번 9.5일 마치기">
          {!archiveReview ? <button type="button" disabled={busy || !writable} onClick={() => setArchiveReview(true)}>이번 훈련 마치기</button> : <>
            <p>{activeCycle}차 9.5일 훈련을 마치고 보관할까요?</p>
            <p>진행 표시를 함께 보관해요. 다음 훈련은 따로 시작하며 놓친 훈련은 추가하지 않아요.</p>
            <button type="button" disabled={busy || !writable} onClick={() => { void run(async () => {
              if (!stored) return
              const result = await archiveGoalTrainingProgramCycle({ programId: stored.program.programId, expectedRevision: stored.revision })
              if (!current()) return
              setRead(readGoalTrainingProgram()); setArchiveReview(false)
              if (result.kind !== "archived") setError(failureMessage(result.code))
              else setNotice("이번 9.5일 훈련과 진행 표시를 보관했어요.")
            }) }}>마치고 보관</button><button type="button" disabled={busy} onClick={() => setArchiveReview(false)}>계속 보기</button>
          </>}
        </section>}
        {stored && <button type="button" className="plan-text-action" disabled={busy}
          onClick={() => { setReplaceConfirmed(false); setExpiredPendingReview(null); setStage("entry"); setRequest(undefined); setEntryDirty(false) }}>목표·날짜를 바꿔 새로 만들기</button>}
      </>}
      {!projectionInvalid && <>
      <PlanSchedulePreview key={stored?.program.programId ?? preview?.generatedAt} startDate={source.window.startDate}
        sessions={sessions} presentation="prescription-calendar" programProjection={{ kind: "THREE_CYCLE_PROGRAM", calendarDayCount: 29 }}
        dayAnnotations={annotations}
        sessionProgress={!preview && stored ? session => {
          const day = sourceDays[session.day - 1]
          const state = day && stored.cycles[day.cycle - 1]?.latestPlan
          return state?.progress.find(item => item.sessionDay === day?.session.day && item.sessionSlot === day?.session.slot)?.state
        } : undefined}
        showRpeGuide={false} detailsExpanded={false} allowMemoExport={false} /></>}
      {!preview && backupTools}
    </>}
  </section>
}
