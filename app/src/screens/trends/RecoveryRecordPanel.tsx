import React from "react"
import { ChevronRight } from "lucide-react"
import { InfoDisclosure } from "../../components/InfoDisclosure"
import type { JournalEntry } from "../../domain/journal-schema"
import type { StructuredJournalObservation } from "../../domain/journal-observation"
import { compactDate } from "../../domain/dates"
import { readDailyContexts, type DailyContext } from "../../domain/daily-context"
import { localAccountScopeSnapshot } from "../../domain/account/local-account-scope"
import { localJournalScopeGeneration, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { FatigueExperimentPanel } from "./FatigueExperimentPanel"
import "./recovery-record.css"

type PriorContextView = {
  readonly accountScope: string | null
  readonly scopeGeneration: number
  readonly contexts: readonly DailyContext[] | null
  readonly unavailable: boolean
}

function readPriorContexts(): PriorContextView {
  const accountScope = localAccountScopeSnapshot()
  const scopeGeneration = localJournalScopeGeneration()
  const result = readDailyContexts()
  const stillCurrent = accountScope === localAccountScopeSnapshot() && scopeGeneration === localJournalScopeGeneration()
  const contexts = result.kind === "loaded"
    ? result.contexts.filter(context => context.mood !== null || context.body !== null || context.weather !== null)
    : null
  return {
    accountScope,
    scopeGeneration,
    contexts: stillCurrent ? contexts : null,
    unavailable: stillCurrent && result.kind === "unavailable",
  }
}

function PriorDailyContexts() {
  const [view, setView] = React.useState(readPriorContexts)
  const currentScope = localAccountScopeSnapshot()
  const currentGeneration = localJournalScopeGeneration()
  const matches = view.accountScope === currentScope && view.scopeGeneration === currentGeneration

  React.useEffect(() => {
    const refresh = () => setView(readPriorContexts())
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener("trainoracle:daily-context-changed", refresh)
    const unsubscribeScope = onLocalJournalScopeChange(refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener("trainoracle:daily-context-changed", refresh)
      unsubscribeScope()
    }
  }, [])

  const contexts = matches ? view.contexts : null
  if (!matches) return null
  if (view.unavailable) return <div className="recovery-record__prior-error" role="status" aria-label="이전에 남긴 상태">
    <span>이전 상태를 불러오지 못했어요</span>
    <button type="button" onClick={() => setView(readPriorContexts())}>다시 불러오기</button>
  </div>
  if (!contexts || contexts.length === 0) return null

  return <InfoDisclosure className="recovery-record__prior" title="이전에 남긴 상태" preview={`${contexts.length}일`}>
    <ul className="recovery-record__prior-list">{contexts.map(context => <li key={context.date}>
      <time dateTime={context.date}>{context.date}</time>
      <span>{dailyContextSummary(context)}</span>
    </li>)}</ul>
  </InfoDisclosure>
}

function dailyContextSummary(context: DailyContext): string {
  return [
    context.mood !== null ? `기분 ${({ LOW: "낮음", OKAY: "괜찮음", GOOD: "좋음" } as const)[context.mood]}` : null,
    context.body !== null ? `몸 상태 ${({ TIRED: "피곤", NORMAL: "보통", LIGHT: "가벼움" } as const)[context.body]}` : null,
    context.weather !== null ? `날씨 ${({ SUNNY: "맑음", CLOUDY: "흐림", RAINY: "비", COLD: "추움", HOT: "더움" } as const)[context.weather]}` : null,
  ].filter((value): value is string => value !== null).join(" · ")
}

export function RecoveryRecordPanel({ today, entries, observations, onWriteRecovery, onOpenDay, experimentalFatigue }: {
  readonly today: string
  readonly entries: readonly JournalEntry[]
  readonly observations: readonly StructuredJournalObservation[]
  readonly onWriteRecovery?: (() => void) | undefined
  readonly onOpenDay?: ((date: string, entryId?: string) => void) | undefined
  readonly experimentalFatigue: boolean
}) {
  const session = observations.filter(item => item.loggedOn <= today && item.rpe !== null && item.fieldProvenance.rpe === "EXPLICIT")
    .sort((a, b) => b.loggedOn.localeCompare(a.loggedOn) || (b.sourceRef.observedAt ?? "").localeCompare(a.sourceRef.observedAt ?? ""))[0]
  const source = session ? entries.find(item => item.id === session.sourceRef.sourceId) : undefined
  const slot = source?.kind === "post-session" ? source.activitySlot === "AM" ? " · 오전" : source.activitySlot === "PM" ? " · 오후" : "" : ""
  return <section className="recovery-record" aria-label="몸 상태와 회복 기록">
    <PriorDailyContexts />
    {onWriteRecovery && <button className="recovery-record__action" type="button" onClick={onWriteRecovery}><span>컨디션 기록</span><ChevronRight size={18} aria-hidden="true" /></button>}
    {session && <div className="recovery-record__last">
      <span>최근 운동 · 힘든 정도 {session.rpe}/10</span>
      <small>{compactDate(session.loggedOn)}{slot}</small>
      {onOpenDay && <button type="button" onClick={() => onOpenDay(session.loggedOn, session.sourceRef.sourceId)}>이 기록 보기<ChevronRight size={16} aria-hidden="true" /></button>}
    </div>}
    {experimentalFatigue && <InfoDisclosure purpose="actions" title="피로도 항목별 기록 · 실험" preview="기존 다섯 항목과 입력값 평균">
      <FatigueExperimentPanel />
    </InfoDisclosure>}
  </section>
}
