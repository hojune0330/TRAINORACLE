// TRAINORACLE — App (Phase 1)
// F0-d 실데이터화: 실서비스 화면(홈·상세·추이)은 로컬 실데이터 전용.
// 데모 변형(variant B/C 등)은 제거 — 기록은 git 히스토리와 Guide 화면이 보존.
// 넓은 화면 = 디자인 워크스페이스 (실데이터 기준 프레임 나열).
import { AppShell, useIsMobileShell } from "./AppShell"
import { MobileFrame } from "./components/MobileFrame"
import { Home } from "./screens/Home"
import { LogEntry } from "./screens/LogEntry"
import { LogDetail } from "./screens/LogDetail"
import { Trends } from "./screens/Trends"
import { Guide } from "./screens/Guide"
import { FirstPage } from "./screens/home/FirstPage"
import { PlanBeta } from "./screens/PlanBeta"
import { todayISO } from "./domain/journal-store"

export default function App() {
  const appShell = useIsMobileShell()
  if (appShell) return <AppShell />
  return <Workspace />
}

function Workspace() {
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
        <MobileFrame label="FIRST VISIT · WELCOME">
          <FirstPage initialStep="welcome" onWriteLog={() => {}} onOpenPlan={() => {}} />
        </MobileFrame>

        <MobileFrame label="FIRST VISIT · ONE CONTEXT">
          <FirstPage initialStep="context" onWriteLog={() => {}} />
        </MobileFrame>

        <MobileFrame label="PLAN · BETA">
          <PlanBeta onWriteLog={() => {}} />
        </MobileFrame>

        <MobileFrame label="HOME · 실데이터">
          <Home onWriteLog={() => {}} onOpenDay={() => {}} onOpenGuide={() => {}} />
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
          <MobileFrame label="DETAIL · 실데이터 (오늘)">
            <LogDetail date={todayISO()} onBack={() => {}} />
          </MobileFrame>
        </div>

        <MobileFrame label="TRENDS · 실데이터">
          <Trends onBack={() => {}} />
        </MobileFrame>

        <MobileFrame label="GUIDE · 예시 전용">
          <Guide onWriteLog={() => {}} />
        </MobileFrame>
      </div>
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
        매일 들어와 일지 쓰고, 추이를 본다. 모든 프레임은 실데이터 기준.
        <br />손글씨 영역 = 사용자 입력 · UI 영역 = 모노 라벨 + 직각 박스
      </div>
    </div>
  )
}

function Dot() {
  return <span style={{ display: "inline-block", width: 4, height: 4, background: "var(--brand)", borderRadius: "50%", margin: "0 2px", transform: "translateY(-4px)" }}></span>
}
