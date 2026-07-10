// TRAINORACLE — App (Phase 1)
// v3 JSX(App.jsx) 포팅. 7개 프레임 나란히 + 컴팩트 변형 컨트롤.
// tweaks_panel.jsx(772줄, 디자인 탐색 도구)는 앱 워크스페이스 목적에 맞게
// 동일 기능의 타입 세이프 컨트롤 바로 재설계 (총책임자 설계 결정).
import React from "react"
import { AppShell, useIsMobileShell } from "./AppShell"
import { MobileFrame } from "./components/MobileFrame"
import { Home } from "./screens/Home"
import type { HomeVariant, Encoding } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import { LogDetail } from "./screens/LogDetail"
import type { LogDetailVariant } from "./screens/LogDetail"
import { Trends } from "./screens/Trends"
import type { TrendsVariant } from "./screens/Trends"

interface Tweaks {
  homeVariant: HomeVariant
  logDetailVariant: LogDetailVariant
  trendsVariant: TrendsVariant
  showAI: boolean
  encoding: Encoding
}

const TWEAK_DEFAULTS: Tweaks = {
  homeVariant: "A",
  logDetailVariant: "A",
  trendsVariant: "A",
  showAI: true,
  encoding: "dot-code",
}

export default function App() {
  // 모바일(≤700px) 또는 ?app=1 → 실제 앱 셸. 넓은 화면 = 디자인 워크스페이스.
  const mobile = useIsMobileShell()
  if (mobile) return <AppShell />
  return <Workspace />
}

function Workspace() {
  const [t, setT] = React.useState<Tweaks>(TWEAK_DEFAULTS)
  const set = <K extends keyof Tweaks>(k: K, v: Tweaks[K]) => setT(prev => ({ ...prev, [k]: v }))

  return (
    <div style={{
      minHeight: "100vh",
      background: "#E4E2DA",
      padding: "40px 30px",
      display: "flex", flexDirection: "column", gap: 20,
      fontFamily: "var(--sans)", color: "var(--ink)",
    }}>
      <Header />

      {/* Row of frames */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 40,
        padding: "0 0 30px", justifyContent: "flex-start",
      }}>
        <MobileFrame label={`HOME · variant ${t.homeVariant}`}>
          <Home
            variant={t.homeVariant}
            showAI={t.showAI}
            encoding={t.encoding}
            onWriteLog={() => {}}
            onOpenDay={() => {}}
          />
        </MobileFrame>

        <MobileFrame label="LOG · CHOOSE">
          <LogEntry entryType="choose" onBack={() => {}} onDone={() => {}} />
        </MobileFrame>

        <MobileFrame label="LOG · POST-SESSION">
          <LogEntry entryType="post-session" onBack={() => {}} />
        </MobileFrame>

        <MobileFrame label="LOG · EVENING">
          <LogEntry entryType="evening" onBack={() => {}} />
        </MobileFrame>

        <MobileFrame label="LOG · RACE">
          <LogEntry entryType="race" onBack={() => {}} />
        </MobileFrame>

        <div className="print-target">
          <MobileFrame label={`DETAIL · variant ${t.logDetailVariant}`}>
            <LogDetail variant={t.logDetailVariant} onBack={() => {}} />
          </MobileFrame>
        </div>

        <MobileFrame label={`TRENDS · variant ${t.trendsVariant}`}>
          <Trends variant={t.trendsVariant} onBack={() => {}} />
        </MobileFrame>
      </div>

      {/* Compact controls */}
      <ControlBar>
        <ControlGroup label="Home">
          <Seg value={t.homeVariant} onChange={v => set("homeVariant", v)}
            options={[["A", "Journal"], ["B", "Data"], ["C", "Recall"]]} />
        </ControlGroup>
        <ControlGroup label="Log detail">
          <Seg value={t.logDetailVariant} onChange={v => set("logDetailVariant", v)}
            options={[["A", "Journal"], ["B", "Dashboard"]]} />
        </ControlGroup>
        <ControlGroup label="Trends">
          <Seg value={t.trendsVariant} onChange={v => set("trendsVariant", v)}
            options={[["A", "Scroll"], ["B", "Tabs"]]} />
        </ControlGroup>
        <ControlGroup label="AI 인사이트">
          <Seg value={t.showAI ? "on" : "off"} onChange={v => set("showAI", v === "on")}
            options={[["on", "표시"], ["off", "숨김"]]} />
        </ControlGroup>
      </ControlBar>
    </div>
  )
}

function Header() {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      padding: "0 4px", marginBottom: 4, gap: 14,
    }}>
      <div>
        <div style={{ fontFamily: "var(--sans)", fontSize: 22, fontWeight: 600, letterSpacing: "0.03em", color: "var(--ink)" }}>
          TRAIN<Dot />O<Dot />RACLE
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 4 }}>
          app · phase 1 · journal-first · 모바일 우선
        </div>
      </div>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink-3)",
        letterSpacing: "0.04em", textAlign: "right", lineHeight: 1.6, maxWidth: 380,
      }}>
        매일 들어와 일지 쓰고, 추이를 본다. <b style={{ color: "var(--ink)" }}>아래 컨트롤</b>로 변형 전환.
        <br />손글씨 영역 = 사용자 입력 · UI 영역 = 모노 라벨 + 직각 박스
      </div>
    </div>
  )
}

function Dot() {
  return <span style={{ display: "inline-block", width: 4, height: 4, background: "var(--brand)", borderRadius: "50%", margin: "0 2px", transform: "translateY(-4px)" }}></span>
}

// ───────── Compact control bar (직각 미감 유지) ─────────
function ControlBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", right: 20, bottom: 20, zIndex: 50,
      background: "var(--surface)", border: "1px solid var(--ink)",
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12,
      boxShadow: "0 20px 60px -20px rgba(0,0,0,0.25)",
      maxWidth: 260,
    }}>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 10, fontWeight: 600,
        letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 5, height: 5, background: "var(--brand)", borderRadius: "50%" }}></span>
        Variants
      </div>
      {children}
    </div>
  )
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--ink-3)",
        letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5,
      }}>{label}</div>
      {children}
    </div>
  )
}

function Seg<V extends string>({ value, onChange, options }: {
  value: V
  onChange: (v: V) => void
  options: [V, string][]
}) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--ink)" }}>
      {options.map(([v, l], i) => (
        <button key={v} onClick={() => onChange(v)} style={{
          flex: 1, padding: "7px 8px",
          background: value === v ? "var(--ink)" : "transparent",
          color: value === v ? "var(--bg)" : "var(--ink-2)",
          border: 0, borderRight: i < options.length - 1 ? "1px solid var(--ink)" : 0,
          fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.04em",
          cursor: "pointer", whiteSpace: "nowrap",
        }}>{l}</button>
      ))}
    </div>
  )
}
