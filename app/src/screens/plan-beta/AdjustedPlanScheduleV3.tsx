import React from "react"
import { accountPlansEnabled } from "../../domain/account/account-plan-service"
import { Check, CircleMinus, RefreshCw, HeartPulse, PenLine, Download, FileUp, ArrowRight } from "lucide-react"
import type { readStoredAdjustedPlanStateV5 } from "../../domain/adjusted-plan-storage-v5"
import { saveAdjustedPlanProgressV3 } from "../../domain/adjusted-plan-progress"
import type { RetainedAdjustedPlanEvidenceV3 } from "../../domain/selected-adjusted-plan-v3"
import { AdjustedPrescriptionV3 } from "./AdjustedPrescriptionV3"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession, type PlannedSessionLogDraft } from "../../domain/planned-session-link"
import { ENERGY_INTENT_LABELS, PROGRESS_LABELS } from "./labels"
import { isoShift } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import { retainAdjustedOriginalPlanV3 } from "../../domain/adjusted-plan-archive-v3"
import { exportAdjustedPlanBackupV3 } from "../../domain/adjusted-plan-backup-v3"
import "./AdjustedPlanSchedule.css"

type Loaded = Extract<ReturnType<typeof readStoredAdjustedPlanStateV5>, { kind: "loaded" }>
export function AdjustedPlanScheduleV3({ loaded, readEvidence, onStoredChange, onWritePlannedSessionLog, returnToSession, onImportPlan, onPrepareNext }: {
  readonly loaded: Loaded; readonly readEvidence: () => readonly RetainedAdjustedPlanEvidenceV3[]; readonly onStoredChange: () => void;
  readonly onWritePlannedSessionLog?: (draft: PlannedSessionLogDraft) => void;
  readonly returnToSession?: PlannedSessionLogDraft["link"];
  readonly onImportPlan?: () => void;
  readonly onPrepareNext?: () => void;
}) {
  const plan = loaded.state.selection, start = plan.intake.startDate ?? plan.generatedAt.slice(0, 10)
  const days = [...new Set(plan.activePlan.sessions.map(s => s.day))].sort((a, b) => a - b)
  const [day, setDay] = React.useState(() => resolveCurrentPlannedSession(plan, returnToSession)?.day
    ?? days.find(d => isoShift(start, d - 1) === todayISO()) ?? days[0]!)
  const [error, setError] = React.useState<string | null>(null), [saving, setSaving] = React.useState(false)
  const date = isoShift(start, day - 1), explanation = loaded.explanation
  return <section className="plan-active adjusted-plan-schedule" aria-labelledby="adjusted-v3-title">
    <h1 id="adjusted-v3-title">내 훈련 일정</h1><p>{start}부터 · {days.length}일 일정</p>
    <nav aria-label="훈련 날짜">{days.map(d => <button type="button" key={d} aria-pressed={d === day}
      onClick={() => { setDay(d); setError(null) }}>{isoShift(start, d - 1).slice(5).replace("-", "/")}</button>)}</nav>
    <h2>{date} ({new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(`${date}T12:00:00`))})</h2>
    {plan.activePlan.sessions.filter(s => s.day === day).sort((a, b) => a.slot.localeCompare(b.slot)).map(session => {
      const time = session.slot === "AM" ? "오전" : "오후"
      const recorded = loaded.state.progress.find(r => r.sessionDay === day && r.sessionSlot === session.slot)
      return <section key={session.slot} aria-label={`${time} 훈련`}><h3>{time} · {session.role === "REST" ? "휴식" : ENERGY_INTENT_LABELS[session.plannedEnergyIntent].title}</h3>
        <AdjustedPrescriptionV3 session={session} explanation={explanation} />
        <p role="status">{recorded ? PROGRESS_LABELS[recorded.state] : "아직 진행 기록이 없어요."}</p>
        <div role="group" aria-label={`${time} 진행 기록`}>{([
          ["COMPLETED", Check], ["RESTED", CircleMinus], ["SKIPPED", RefreshCw], ["PAIN_CHECKIN", HeartPulse],
        ] as const).filter(([state]) => session.role !== "REST" || state !== "COMPLETED").map(([state, Icon]) => <button type="button" key={state}
          disabled={saving} aria-pressed={recorded?.state === state} onClick={async () => {
            setSaving(true); setError(null)
            try {
              const result = await saveAdjustedPlanProgressV3({ expectedFingerprint: loaded.state.contentFingerprint,
                progress: { sessionDay: day, sessionSlot: session.slot, state }, retained: readEvidence() })
              if (result.kind === "saved") onStoredChange()
              else setError(result.code === "PAIN_REVIEW_REQUIRED" ? "통증 확인 기록은 완료나 휴식으로 바꾸지 않아요."
                : "저장하지 못했어요. 현재 계획을 다시 확인해 주세요.")
            } catch { setError("저장하지 못했어요. 현재 계획을 다시 확인해 주세요.") }
            finally { setSaving(false) }
          }}><Icon size={16} aria-hidden="true" />{PROGRESS_LABELS[state]}</button>)}</div>
        {onWritePlannedSessionLog && <button type="button" disabled={saving} onClick={async () => {
          const draft = createPlannedSessionLogDraft(plan, session, new Date().toISOString())
          if (draft === null) { setError("훈련 연결 정보를 확인하지 못했어요. 일지는 열지 않았어요."); return }
          setSaving(true); setError(null)
          try {
            const result = await retainAdjustedOriginalPlanV3(loaded.state.contentFingerprint, { retained: readEvidence() })
            if (result.kind !== "retained") { setError("계획 원본을 보관하지 못했어요. 연결된 일지는 아직 열지 않았어요."); return }
            onWritePlannedSessionLog(draft)
          } catch { setError("계획 원본을 보관하지 못했어요. 다시 시도해 주세요.") }
          finally { setSaving(false) }
        }}><PenLine size={18} aria-hidden="true" />이 훈련 일지 쓰기</button>}
      </section>
    })}
    {error && <p role="alert">{error}</p>}
    {onPrepareNext && <button type="button" disabled={saving} onClick={onPrepareNext}>
      <ArrowRight size={18} aria-hidden="true" />다음 훈련 주기 준비</button>}
    <details><summary>저장과 이용 안내</summary><p>{accountPlansEnabled() ? "계정에서 확인한 계획이에요. 미전송 변경은 계정 저장 확인과 별도로 표시해요." : "현재 이 기기에 저장된 계획이에요. 서버 보관은 아직 연결 중이에요."}</p>
      <p>개인 보관 파일에는 페이스 계산에 사용한 기록과 진행 상태가 포함돼요. 메모는 포함하지 않아요. 다른 사람에게 공유하지 마세요.</p>
      <button type="button" onClick={() => {
        let url: string | undefined
        try {
          const result = exportAdjustedPlanBackupV3(loaded.state.contentFingerprint, readEvidence())
          if (result.kind !== "exported") { setError("계획 원본을 확인하지 못해 파일을 만들지 않았어요."); return }
          url = URL.createObjectURL(new Blob([result.raw], { type: "application/json" }))
          const link = document.createElement("a")
          link.href = url; link.download = `trainoracle-plan-${todayISO()}.json`; link.click(); setError(null)
        } catch { setError("계획 파일을 내려받지 못했어요. 저장된 계획은 그대로예요.") }
        finally { if (url) { const savedUrl = url; setTimeout(() => URL.revokeObjectURL(savedUrl), 1000) } }
      }}><Download size={18} aria-hidden="true" />개인 보관용 계획 파일 받기</button>
      {onImportPlan && <button type="button" onClick={onImportPlan}><FileUp size={18} aria-hidden="true" />개인 계획 파일 불러오기</button>}
    </details>
  </section>
}
