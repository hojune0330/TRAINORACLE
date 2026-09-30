import React from "react"
import { CatalogWorkoutEditor } from "./CatalogWorkoutPicker"
import { catalogProtectedSlots, prepareCatalogReplacement } from "../../domain/catalog-replacement"
import { prepareCurrentCatalogReplacement, applyCatalogReplacement } from "../../domain/catalog-replacement-store"
import { replanFingerprint } from "../../domain/execution-replan"
import { loadEntriesForPlanSafety, todayISO } from "../../domain/journal-store"
import { loadAthleteRecords } from "../../domain/athlete-records"
import type { PlanBetaStateV3 } from "../../domain/plan-beta-schema"
import { sessionWorkoutName } from "../../domain/workout-notation"
import { isoShift } from "../../domain/dates"
import { usePlanDraftNavigationGuard } from "./usePlanDraftNavigationGuard"

export function ActiveCatalogWorkoutPicker({ state, onApplied }: { state: PlanBetaStateV3; onApplied: (state: PlanBetaStateV3) => void }) {
  const [read, setRead] = React.useState(loadEntriesForPlanSafety)
  const [records, setRecords] = React.useState(loadAthleteRecords)
  const [address, setAddress] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [revision, setRevision] = React.useState(0)
  const [noRisk, setNoRisk] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [uncertain, setUncertain] = React.useState(false)
  const [message, setMessage] = React.useState("")
  const history = React.useRef(new Map<string, Set<string>>())
  usePlanDraftNavigationGuard(pending, uncertain
    ? "변경이 저장됐는지 아직 확인하지 못했어요. 이동한 뒤 현재 일정을 다시 확인해 주세요. 이동할까요?"
    : "아직 적용하지 않은 훈련 변경이 있어요. 변경을 취소하고 이동할까요?", busy)
  if (!state.intake.startDate || state.activePlan.selectionActor !== "SELF") return null
  const protectedSlots = read.status === "complete" ? catalogProtectedSlots(state, read.entries, todayISO()) : []
  const sessions = read.status !== "complete" ? [] : state.activePlan.sessions.filter(s => s.role !== "REST"
    && s.prescription.kind === "RPE_TIME_RANGE" && !protectedSlots.some(p => p.day === s.day && p.slot === s.slot))
  const session = sessions.find(s => `${s.day}:${s.slot}` === address) ?? sessions[0]
  return <details className="plan-session-guidance catalog-workout-picker" onToggle={e => {
    if (e.currentTarget.open) { setRead(loadEntriesForPlanSafety()); setRecords(loadAthleteRecords()) }
  }}>
    <summary>앞으로 할 훈련 바꾸기</summary>
    {session ? <>
      <label>바꿀 일정<select value={`${session.day}:${session.slot}`} disabled={busy || uncertain || pending}
        onChange={e => { setAddress(e.target.value); setNoRisk(false); setMessage("") }}>
        {sessions.map(s => <option key={`${s.day}:${s.slot}`} value={`${s.day}:${s.slot}`}>
          {isoShift(state.intake.startDate!, s.day - 1)} {s.slot === "AM" ? "오전" : "오후"} · {sessionWorkoutName(s)}
        </option>)}
      </select></label>
      <small>날짜와 훈련 목적은 그대로예요. 원래 계획과 작성한 일지는 남겨둬요.</small>
      <label><input type="checkbox" checked={noRisk} disabled={busy || uncertain} onChange={e => setNoRisk(e.target.checked)} />지금 통증이나 몸 상태 이상이 없어요</label>
      <CatalogWorkoutEditor key={`${state.activePlan.candidateId}:${session.day}:${session.slot}:${revision}`}
        intake={state.intake} records={records} session={session} drawHistory={history.current}
        disabled={busy || uncertain} applyDisabled={!noRisk} onPendingChange={setPending}
        onCancel={() => { setRevision(n => n + 1); setNoRisk(false); setMessage("") }}
        canSelect={(id, inputs, acceptLonger) => read.status === "complete" && prepareCatalogReplacement({ state,
          entries: read.entries, today: todayISO(), now: new Date().toISOString(), address: { day: session.day, slot: session.slot },
          catalogId: id, inputs, acceptStronger: true, acceptLonger, journalGuard: null }).kind === "ready"}
        onSelect={(catalogId, inputs, acceptLonger) => {
          if (busy || uncertain || !noRisk) return
          setBusy(true); setMessage("")
          void (async () => {
            try {
              const prepared = await prepareCurrentCatalogReplacement({ address: { day: session.day, slot: session.slot },
                catalogId, inputs, acceptLonger, acceptStronger: true })
              if (prepared.kind === "blocked") { setMessage(prepared.message); return }
              if (replanFingerprint(prepared.proposal.before) !== replanFingerprint(state)) {
                setMessage("다른 화면에서 계획이 바뀌었어요. 현재 계획을 다시 열어 주세요.")
                return
              }
              const result = await applyCatalogReplacement(prepared.proposal, noRisk)
              if (result.kind === "applied") onApplied(prepared.proposal.after)
              else { setMessage(result.message); setUncertain(result.kind === "uncertain") }
            } catch { setMessage("변경 상태를 확인하지 못했어요. 현재 일정을 다시 열어 주세요."); setUncertain(true) }
            finally { setBusy(false) }
          })()
        }} />
    </> : <p>{read.status === "complete" ? "바꿀 수 있는 미래 훈련이 없어요. 오늘이나 기록한 훈련은 그대로 남겨둬요." : "기록을 모두 불러온 뒤 바꿀 수 있어요."}</p>}
    {busy && <p role="status">원래 계획을 보관하고 변경을 저장하고 있어요.</p>}
    {message && <p role="alert">{message}</p>}
  </details>
}
