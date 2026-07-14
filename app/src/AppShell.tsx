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
import { Guide } from "./screens/Guide"
import { LOCAL_SAVE_NOTICE, SYNC_UPSELL_NOTICE, localOnlyCount } from "./domain/journal-store"

type Tab = "home" | "log" | "trends" | "guide"

interface ViewState {
  tab: Tab
  /** log 탭 내부 단계 */
  entryType: EntryType
  /** home에서 연 일지 상세 (날짜) — null이면 홈 목록 */
  detailDate: string | null
}

const INITIAL: ViewState = { tab: "home", entryType: "choose", detailDate: null }
const TOAST_READABLE_MS = 4050
const TOAST_EXIT_MS = 150

type ToastPhase = "enter" | "exit"

type SavedToastState = {
  readonly count: number
  readonly phase: ToastPhase
  readonly reviewMessage?: string
}

export function AppShell() {
  const [v, setV] = React.useState<ViewState>(INITIAL)
  const [savedToast, setSavedToast] = React.useState<SavedToastState | null>(null)

  const goHome = () => setV(INITIAL)
  const goHomeAfterSave = (reviewMessage?: string) => {
    setV(INITIAL)
    setSavedToast({ count: localOnlyCount(), phase: "enter", reviewMessage })
  }

  React.useEffect(() => {
    if (savedToast === null) return
    if (savedToast.reviewMessage !== undefined) return
    const delay = savedToast.phase === "enter" ? TOAST_READABLE_MS : TOAST_EXIT_MS
    const t = window.setTimeout(() => {
      setSavedToast(current => {
        if (current === null) return null
        return current.phase === "enter" ? { ...current, phase: "exit" } : null
      })
    }, delay)
    return () => window.clearTimeout(t)
  }, [savedToast])
  const goTab = (tab: Tab) =>
    setV({ tab, entryType: "choose", detailDate: null })

  let screen: React.ReactNode
  if (v.tab === "home") {
    screen = v.detailDate ? (
      <LogDetail date={v.detailDate} onBack={() => setV(s => ({ ...s, detailDate: null }))} />
    ) : (
      <Home
        onWriteLog={() => setV(s => ({ ...s, tab: "log", entryType: "choose" }))}
        onOpenDay={(date) => setV(s => ({ ...s, detailDate: date }))}
        onOpenGuide={() => setV(s => ({ ...s, tab: "guide" }))}
      />
    )
  } else if (v.tab === "log") {
    screen = (
      <LogEntry
        entryType={v.entryType}
        onBack={v.entryType === "choose" ? goHome : () => setV(s => ({ ...s, entryType: "choose" }))}
        onDone={(picked, reviewMessage) => {
          if (v.entryType === "choose") {
            setV(s => ({ ...s, entryType: picked }))
          } else {
            goHomeAfterSave(reviewMessage)
          }
        }}
      />
    )
  } else if (v.tab === "trends") {
    screen = <Trends onBack={goHome} />
  } else {
    screen = <Guide onWriteLog={() => setV({ tab: "log", entryType: "choose", detailDate: null })} />
  }

  return (
    <div className="app-shell" style={{
      height: "100dvh", minHeight: 0, background: "var(--bg)",
      display: "flex", flexDirection: "column",
      maxWidth: 520, margin: "0 auto",
    }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 62 }}>
        {screen}
      </div>
      {savedToast !== null && (
        <SavedToast
          count={savedToast.count}
          phase={savedToast.phase}
          reviewMessage={savedToast.reviewMessage}
          onDismiss={() => setSavedToast(null)}
        />
      )}
      <TabBar tab={v.tab} onTab={goTab} />
    </div>
  )
}

/** 저장 직후 안내 — 로컬 우선 원칙을 사용자 언어로.
 *  문구 소스는 journal-store (이중정의 금지). 계정 연동(F3) 전까지 업셀은 안내만, 버튼 없음. */
export function SavedToast({ count, phase, reviewMessage, onDismiss }: {
  readonly count: number
  readonly phase: ToastPhase
  readonly reviewMessage?: string
  readonly onDismiss?: () => void
}) {
  return (
    <div role={reviewMessage === undefined ? "status" : "alert"} aria-atomic="true" className={`saved-toast saved-toast--${phase}`} style={{
      position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
      zIndex: 40, maxWidth: 520, margin: "0 auto", padding: "0 16px",
      pointerEvents: reviewMessage === undefined ? "none" : "auto",
    }}>
      <div className="saved-toast__surface" style={{
        background: "var(--ink)", color: "var(--bg)",
        padding: "11px 14px", border: "1px solid var(--ink)",
        display: "flex", flexDirection: "column", gap: 3,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em" }}>
            ✓ {LOCAL_SAVE_NOTICE}{count > 0 ? ` · 이 기기에 ${count}건` : ""}
          </span>
          {reviewMessage !== undefined && (
            <button type="button" aria-label="검토 안내 닫기" title="닫기" onClick={onDismiss} style={{
              border: 0, background: "transparent", color: "var(--bg)", cursor: "pointer",
              padding: 4, fontFamily: "var(--mono)", fontSize: 18, lineHeight: 1,
            }}>×</button>
          )}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, opacity: 0.75, letterSpacing: "0.03em" }}>
          {reviewMessage === undefined ? SYNC_UPSELL_NOTICE : `분석 결과를 확인해야 해요. ${reviewMessage}`}
        </div>
      </div>
    </div>
  )
}

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const items: [Tab, string, string][] = [
    ["home", "—", "홈"],
    ["log", "＋", "기록"],
    ["trends", "↗", "추이"],
    ["guide", "?", "가이드"],
  ]
  return (
    <nav aria-label="주 탭" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30,
      maxWidth: 520, margin: "0 auto",
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
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
