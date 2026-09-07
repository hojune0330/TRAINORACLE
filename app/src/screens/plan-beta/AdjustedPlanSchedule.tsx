import React from "react"
import { PenLine, Check, CircleMinus, RefreshCw, HeartPulse, ArrowRight, Download } from "lucide-react"
import type { exportAdjustedPlanBackup } from "../../domain/adjusted-plan-backup"
import type { PlanBetaStateReadResult } from "../../domain/plan-beta-store"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession, type PlannedSessionLogDraft } from "../../domain/planned-session-link"
import { isoShift } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import { ENERGY_INTENT_LABELS, PROGRESS_LABELS } from "./labels"
import { saveAdjustedPlanProgress } from "../../domain/adjusted-plan-progress"
import { TermHelp } from "../../components/TermHelp"
import { AdjustedJournalOriginalPlan } from "../journal/AdjustedJournalOriginalPlan"
import "./AdjustedPlanSchedule.css"

export function AdjustedPlanSchedule({ loaded, onWritePlannedSessionLog, returnToSession, onStoredChange, onPrepareNext, onExportPlan }: {
  readonly loaded: Extract<PlanBetaStateReadResult, { kind: "adjusted_loaded" }>
  readonly onWritePlannedSessionLog?: (draft: PlannedSessionLogDraft) => void
  readonly returnToSession?: PlannedSessionLogDraft["link"]
  readonly onStoredChange: () => void
  readonly onPrepareNext?: () => void
  readonly onExportPlan?: () => ReturnType<typeof exportAdjustedPlanBackup>
}) {
  const plan = loaded.state.selection
  const start = plan.intake.startDate ?? plan.generatedAt.slice(0, 10)
  const days = [...new Set(plan.activePlan.sessions.map(session => session.day))].sort((a, b) => a - b)
  const [day, setDay] = React.useState(() => {
    const linked = resolveCurrentPlannedSession(plan, returnToSession)
    return linked?.day ?? days.find(value => isoShift(start, value - 1) === todayISO()) ?? days[0]!
  })
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const date = isoShift(start, day - 1)
  return <section className="plan-active adjusted-plan-schedule" aria-labelledby="adjusted-plan-title">
    <h1 id="adjusted-plan-title">내 훈련 일정</h1>
    <p>{start}부터 · {days.length}일 일정</p>
    <nav aria-label="훈련 날짜" className="plan-day-navigation">
      {days.map(value => <button type="button" key={value} aria-pressed={day === value}
        onClick={() => { setDay(value); setError(null) }}>{isoShift(start, value - 1).slice(5).replace("-", "/")}</button>)}
    </nav>
    <h2>{date} ({new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(`${date}T12:00:00`))})</h2>
    {plan.activePlan.sessions.filter(session => session.day === day)
      .sort((a, b) => a.slot.localeCompare(b.slot)).map(session => {
      const label = ENERGY_INTENT_LABELS[session.plannedEnergyIntent]
      const recorded = loaded.state.progress.find(item => item.sessionDay === day && item.sessionSlot === session.slot)
      return <section key={session.slot} aria-label={`${session.slot === "AM" ? "오전" : "오후"} 훈련`}>
        <h3>{session.slot === "AM" ? "오전" : "오후"} · {session.role === "REST" ? "휴식" : label.title}</h3>
        <TermHelp term={label.term} />
        <AdjustedJournalOriginalPlan session={session} explanation={loaded.explanation} context="plan" />
        <p role="status">{recorded === undefined ? "아직 진행 기록이 없어요." : PROGRESS_LABELS[recorded.state]}</p>
        <div role="group" aria-label={`${session.slot === "AM" ? "오전" : "오후"} 진행 기록`}>
          {([{ state: "COMPLETED", Icon: Check }, { state: "RESTED", Icon: CircleMinus },
            { state: "SKIPPED", Icon: RefreshCw }, { state: "PAIN_CHECKIN", Icon: HeartPulse }] as const)
            .filter(item => session.role !== "REST" || item.state !== "COMPLETED").map(({ state, Icon }) =>
              <button type="button" key={state} disabled={saving} aria-pressed={recorded?.state === state}
                onClick={async () => {
                  setSaving(true); setError(null)
                  const result = await saveAdjustedPlanProgress({ expectedFingerprint: loaded.state.contentFingerprint,
                    progress: { sessionDay: day, sessionSlot: session.slot, state } })
                  setSaving(false)
                  if (result.kind === "saved") onStoredChange()
                  else setError(result.code === "PAIN_REVIEW_REQUIRED"
                    ? "통증 확인 기록은 완료나 휴식으로 바꾸지 않아요. 몸 상태를 먼저 확인해 주세요."
                    : "진행 기록을 저장하지 못했어요. 계획을 다시 열어 현재 상태를 확인해 주세요.")
                }}><Icon size={16} aria-hidden="true" />{PROGRESS_LABELS[state]}</button>)}
        </div>
        {onWritePlannedSessionLog !== undefined && <button type="button" onClick={() => {
          const draft = createPlannedSessionLogDraft(plan, session, new Date().toISOString())
          if (draft === null) { setError("이 훈련의 연결 정보를 확인하지 못했어요. 일지는 열지 않았어요."); return }
          onWritePlannedSessionLog(draft)
        }}><PenLine size={18} aria-hidden="true" />이 훈련 일지 쓰기</button>}
      </section>
    })}
    {error !== null && <p role="alert">{error}</p>}
    {onPrepareNext && <section><h2>다음 훈련 주기</h2>
      <button type="button" onClick={onPrepareNext} disabled={saving}><ArrowRight size={18} aria-hidden="true" />다음 주기 준비</button>
    </section>}
    <details><summary>저장과 이용 안내</summary>
      <p>이 조정 계획은 현재 이 기기에 저장돼 있어요. 서버 보관은 아직 연결 중이에요.</p>
      <p>이 화면의 수치는 저장 당시의 계획이며, 지금 몸 상태에 대한 새 판단이나 훈련 시작 승인은 아니에요.</p>
      {onExportPlan && <>
        <p>개인 보관 파일에는 페이스 계산에 사용한 기록과 훈련 진행 상태가 포함돼요. 메모는 포함하지 않아요. 다른 사람에게 공유하지 마세요. 앱에서 다시 불러오는 화면은 아직 준비 중이에요.</p>
        <button type="button" onClick={() => {
          const result = onExportPlan()
          if (result.kind !== "exported") { setError("계획 원본을 확인하지 못해 파일을 만들지 않았어요."); return }
          let url: string | undefined
          try {
            url = URL.createObjectURL(new Blob([result.raw], { type: "application/json" }))
            const link = document.createElement("a")
            link.href = url; link.download = `trainoracle-plan-${todayISO()}.json`
            link.click(); setError(null)
          } catch { setError("계획 파일을 내려받지 못했어요. 저장된 계획은 그대로예요.") }
          finally { if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000) } }
        }}><Download size={18} aria-hidden="true" />개인 보관용 계획 파일 받기</button>
      </>}
    </details>
  </section>
}
