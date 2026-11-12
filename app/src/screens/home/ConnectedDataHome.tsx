import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { CategoryCard } from "../../components/CategoryCard"
import { AutomaticConnectionEntry } from "../../components/AutomaticConnectionEntry"
import { AppHeading } from "../../components/AppHeading"
import { ConnectedWeeklyFacts } from "./ConnectedWeeklyFacts"
import { useVisibleRefresh } from "../../hooks/useVisibleRefresh"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { garminEndpoint, garminIntegrationEnabled, requestGarminIntegration, type GarminStatus } from "../../domain/account/garmin-integration"
import { accountJournalPreviewEnabled } from "../../domain/account/account-journal-api"
import type { JournalEntry } from "../../domain/journal-schema"
import { isoShift } from "../../domain/dates"

type Props = { entries: readonly JournalEntry[]; today: string; onOpenImport?: () => void; onOpenDay?: (date: string, id?: string) => void; onOpenTrends?: () => void }
export function ConnectedDataHome(props: Props) {
  const generation = useSyncExternalStore(onLocalJournalScopeChange, localJournalScopeGeneration, () => 0)
  return <ConnectedDataSession key={generation} {...props} />
}
function ConnectedDataSession({ entries, today, onOpenImport, onOpenDay }: Props) {
  const owner = activeLocalAccount()
  const enabled = Boolean(owner && garminIntegrationEnabled() && accountJournalPreviewEnabled() && garminEndpoint())
  const [status, setStatus] = useState<GarminStatus | null>(null)
  const preferenceKey = "trainoracle:home-health-view:" + (owner ?? "guest")
  const [preferences, setPreferences] = useState<{ order: string[]; hidden: string[] }>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(preferenceKey) ?? "null")
      if (value && Array.isArray(value.order) && Array.isArray(value.hidden)) return { order: [...new Set<string>([...value.order.filter((id: unknown) => id === "sleep" || id === "heart"), "sleep", "heart"])], hidden: value.hidden.filter((id: unknown) => id === "sleep" || id === "heart") }
    } catch { /* View preferences are optional. */ }
    return { order: ["sleep", "heart"], hidden: [] }
  })
  const [preferenceNotice, setPreferenceNotice] = useState("")
  const changePreferences = (next: typeof preferences) => {
    setPreferences(next)
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)); setPreferenceNotice("") }
    catch { setPreferenceNotice("현재 화면에만 적용했어요. 보기 설정을 보관하지 못했어요.") }
  }
  const [authorizationPaused, setAuthorizationPaused] = useState(false)
  const [failed, setFailed] = useState(false)
  const live = useRef(true), operation = useRef<AbortController | null>(null)
  const refresh = async () => {
    if (!owner || !enabled || operation.current) return true
    const controller = new AbortController(); operation.current = controller
    const current = () => live.current && !controller.signal.aborted && activeLocalAccount() === owner
    try {
      const result = await requestGarminIntegration(owner, { action: "status", experience: true }, controller.signal, current)
      if (!current()) return false
      if (!result.ok) {
        setFailed(true)
        if (["AUTH_REQUIRED", "ACCESS_DENIED", "CONSENT_CHANGED", "STORAGE_CONSENT_REQUIRED"].includes(result.code)) { setStatus(null); setAuthorizationPaused(true) }
        return false
      }
      if (!("capability" in result.data)) { setFailed(true); return false }
      setStatus(result.data); setFailed(false); return true
    } catch { if (current()) setFailed(true); return false }
    finally { if (operation.current === controller) operation.current = null }
  }
  useEffect(() => { live.current = true; void refresh(); return () => { live.current = false; operation.current?.abort() } }, [enabled, owner])
  useVisibleRefresh(refresh, enabled && !authorizationPaused && (!status || status.connection.state === "ACTIVE" || status.connection.state === "PENDING"), owner)
  const health = entries.filter((entry): entry is Extract<JournalEntry, { kind: "evening" }> => entry.kind === "evening" && (entry.date === today || entry.date === isoShift(today, -1)))
    .sort((a,b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))[0]
  const latest = entries.filter(entry => entry.kind === "post-session" && entry.date <= today).sort((a,b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))[0]
  const connected = status?.connection.state === "ACTIVE"
  return <section className="home-hub__connected" aria-label="연결된 운동과 몸 상태">
    {onOpenImport && <AutomaticConnectionEntry onOpen={onOpenImport}
      label={failed ? "연결 확인 필요" : connected ? "Garmin 연결됨" : enabled && !status ? "연결 확인 중" : undefined}
      description={failed ? "연결 상태를 확인하지 못했어요. 눌러서 다시 확인해 주세요."
        : connected ? status.experience?.reviewRequiredCount ? "확인이 필요한 운동 " + status.experience.reviewRequiredCount + "개 · 바로 확인하기"
          : status.connection.lastSyncAt ? "받은 운동과 일지 저장 상태 보기" : "워치 기록이 Garmin Connect에 올라오면 자동으로 받아요."
        : enabled && !status ? "연결 정보를 불러오고 있어요." : undefined} />}
    {latest && onOpenDay && <CategoryCard variant="row" category="journal" title="최근 운동 일지" description={latest.date + " · 운동 수치와 메모 보기"} onClick={() => onOpenDay(latest.date, latest.id)} />}
    <ConnectedWeeklyFacts entries={entries} today={today} onOpenDay={onOpenDay} />
    {health && (health.sleepH > 0 || health.fieldProvenance?.sleepH?.provenance === "EXPLICIT" || health.restingHr) && <section aria-label="오늘의 몸 상태">
      <AppHeading as="h2" variant="section">{health.date === today ? "오늘" : "어제"}의 몸 상태</AppHeading>
      <p className="home-hub__metric-source">내 일지에 적은 값이에요.</p>
      <div className="home-hub__metric-grid">{preferences.order.filter(id => !preferences.hidden.includes(id)).map(id => id === "sleep"
        ? (health.sleepH > 0 || health.fieldProvenance?.sleepH?.provenance === "EXPLICIT") && <button key={id} type="button" className="home-hub__metric" aria-label={"수면 " + health.sleepH + "시간 · " + health.date + " 기록 보기"} onClick={() => onOpenDay?.(health.date, health.id)}><span>수면</span><strong>{health.sleepH}<small>시간</small></strong><span>기록 보기</span></button>
        : health.restingHr && <button key={id} type="button" className="home-hub__metric" aria-label={"안정시 심박 " + health.restingHr + "회/분 · " + health.date + " 기록 보기"} onClick={() => onOpenDay?.(health.date, health.id)}><span>안정시 심박</span><strong>{health.restingHr}<small>회/분</small></strong><span>쉬고 있을 때</span></button>)}</div>
      <details><summary>몸 상태 표시 설정</summary>
        {preferences.order.map((id, index) => <div key={id} className="home-hub__metric-setting">
          <label><input type="checkbox" checked={!preferences.hidden.includes(id)} onChange={event => changePreferences({ ...preferences, hidden: event.target.checked ? preferences.hidden.filter(value => value !== id) : [...preferences.hidden, id] })} />{id === "sleep" ? "수면" : "안정시 심박"}</label>
          {index > 0 && <button type="button" onClick={() => changePreferences({ ...preferences, order: [id, ...preferences.order.filter(value => value !== id)] })}>{id === "sleep" ? "수면" : "안정시 심박"} 먼저 보기</button>}
        </div>)}
        {preferenceNotice && <p role="status">{preferenceNotice}</p>}
      </details>
    </section>}
  </section>
}
