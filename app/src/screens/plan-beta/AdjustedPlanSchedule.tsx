import React from "react"
import { PenLine } from "lucide-react"
import type { PlanBetaStateReadResult } from "../../domain/plan-beta-store"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession, type PlannedSessionLogDraft } from "../../domain/planned-session-link"
import { isoShift } from "../../domain/dates"
import { todayISO } from "../../domain/journal-store"
import { ENERGY_INTENT_LABELS } from "./labels"
import { TermHelp } from "../../components/TermHelp"
import { AdjustedJournalOriginalPlan } from "../journal/AdjustedJournalOriginalPlan"
import "./AdjustedPlanSchedule.css"

export function AdjustedPlanSchedule({ loaded, onWritePlannedSessionLog, returnToSession }: {
  readonly loaded: Extract<PlanBetaStateReadResult, { kind: "adjusted_loaded" }>
  readonly onWritePlannedSessionLog?: (draft: PlannedSessionLogDraft) => void
  readonly returnToSession?: PlannedSessionLogDraft["link"]
}) {
  const plan = loaded.state.selection
  const start = plan.intake.startDate ?? plan.generatedAt.slice(0, 10)
  const days = [...new Set(plan.activePlan.sessions.map(session => session.day))].sort((a, b) => a - b)
  const [day, setDay] = React.useState(() => {
    const linked = resolveCurrentPlannedSession(plan, returnToSession)
    return linked?.day ?? days.find(value => isoShift(start, value - 1) === todayISO()) ?? days[0]!
  })
  const [error, setError] = React.useState<string | null>(null)
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
      return <section key={session.slot} aria-label={`${session.slot === "AM" ? "오전" : "오후"} 훈련`}>
        <h3>{session.slot === "AM" ? "오전" : "오후"} · {session.role === "REST" ? "휴식" : label.title}</h3>
        <TermHelp term={label.term} />
        <AdjustedJournalOriginalPlan session={session} explanation={loaded.explanation} context="plan" />
        {onWritePlannedSessionLog !== undefined && <button type="button" onClick={() => {
          const draft = createPlannedSessionLogDraft(plan, session, new Date().toISOString())
          if (draft === null) { setError("이 훈련의 연결 정보를 확인하지 못했어요. 일지는 열지 않았어요."); return }
          onWritePlannedSessionLog(draft)
        }}><PenLine size={18} aria-hidden="true" />이 훈련 일지 쓰기</button>}
      </section>
    })}
    {error !== null && <p role="alert">{error}</p>}
    <details><summary>저장과 이용 안내</summary>
      <p>이 조정 계획은 현재 이 기기에 저장돼 있어요. 서버 보관과 다음 주기 전환은 아직 연결 중이에요.</p>
      <p>이 화면의 수치는 저장 당시의 계획이며, 지금 몸 상태에 대한 새 판단이나 훈련 시작 승인은 아니에요.</p>
    </details>
  </section>
}
