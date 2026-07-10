// AppShell — 실제 서비스용 모바일 단독 앱 (론칭 대상)
// 데스크톱 넓은 화면 = 디자인 워크스페이스(7프레임) 유지,
// 모바일 뷰포트(≤700px) 또는 ?app=1 = 이 셸 렌더.
// ?workspace=1 로 강제 워크스페이스 가능 (디자인 리뷰용).
import React from "react"
import { Home } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import type { EntryType } from "./screens/LogEntry"
import { LogDetail } from "./screens/LogDetail"
import { Trends } from "./screens/Trends"

type Tab = "home" | "log" | "trends"

interface ViewState {
  tab: Tab
  /** log 탭 내부 단계 */
  entryType: EntryType
  /** home에서 연 일지 상세 (날짜) — null이면 홈 목록 */
  detailDate: string | null
}

const INITIAL: ViewState = { tab: "home", entryType: "choose", detailDate: null }

export function AppShell() {
  const [v, setV] = React.useState<ViewState>(INITIAL)

  const goHome = () => setV(INITIAL)
  const goTab = (tab: Tab) =>
    setV({ tab, entryType: "choose", detailDate: null })

  let screen: React.ReactNode
  if (v.tab === "home") {
    screen = v.detailDate ? (
      <LogDetail variant="A" onBack={() => setV(s => ({ ...s, detailDate: null }))} />
    ) : (
      <Home
        variant="A"
        showAI
        encoding="dot-code"
        onWriteLog={() => setV(s => ({ ...s, tab: "log", entryType: "choose" }))}
        onOpenDay={(date) => setV(s => ({ ...s, detailDate: date }))}
      />
    )
  } else if (v.tab === "log") {
    screen = (
      <LogEntry
        entryType={v.entryType}
        onBack={v.entryType === "choose" ? goHome : () => setV(s => ({ ...s, entryType: "choose" }))}
        onDone={(picked?: string) => {
          if (v.entryType === "choose" && picked) {
            setV(s => ({ ...s, entryType: picked as EntryType }))
          } else {
            goHome()
          }
        }}
      />
    )
  } else {
    screen = <Trends variant="A" onBack={goHome} />
  }

  return (
    <div style={{
      minHeight: "100dvh", background: "var(--bg)",
      display: "flex", flexDirection: "column",
      maxWidth: 520, margin: "0 auto",
    }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 62 }}>
        {screen}
      </div>
      <TabBar tab={v.tab} onTab={goTab} />
    </div>
  )
}

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: [Tab, string, string][] = [
    ["home", "—", "홈"],
    ["log", "＋", "기록"],
    ["trends", "↗", "추이"],
  ]
  return (
    <nav aria-label="주 탭" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30,
      maxWidth: 520, margin: "0 auto",
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
      background: "var(--surface)",
      borderTop: "1px solid var(--ink)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {items.map(([id, mark, label]) => {
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => onTab(id)}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "9px 0 8px", border: 0, cursor: "pointer",
              background: active ? "var(--ink)" : "transparent",
              color: active ? "var(--bg)" : "var(--ink-2)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1, fontWeight: 500 }}>{mark}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.12em", fontWeight: 600 }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

/** 모바일 셸을 쓸지 결정: ?app=1 강제, ?workspace=1 강제 해제, 그 외 뷰포트 폭 기준 */
export function useIsMobileShell(): boolean {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null
  const forced = params?.has("app") ?? false
  const forcedOff = params?.has("workspace") ?? false
  const [narrow, setNarrow] = React.useState<boolean>(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 700px)").matches : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 700px)")
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  if (forcedOff) return false
  if (forced) return true
  return narrow
}
