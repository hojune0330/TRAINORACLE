import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { purgeExpiredTrash } from "./domain/journal-trash"
import { registerAppServiceWorker } from "./domain/pwa-update"
import { FeedbackBoardRoute } from "./screens/FeedbackBoardRoute"

// 토큰 단일 소스: 저장소 루트 CSS를 직접 import (이중 정의 금지)
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "./styles/app.css"
import "./styles/feedback-board.css"
import "./styles/plan-beta.css"
import "./styles/journal-reader.css"
import "./styles/journal-calendar.css"
import "./styles/athlete-records.css"
import "./styles/journal-decoration.css"
import "./styles/decoration-studio.css"
import "./styles/minji-showcase.css"
import "./styles/account-auth.css"

const showP3PaceHarness = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get("p3-pace-fixture") === "1"
const showFeedbackBoard = new URLSearchParams(window.location.search).get("feedback") === "1"

if (import.meta.env.DEV && !showP3PaceHarness) {
  void import("react-grab")
  void import("react-scan").then(({ scan }) => scan({ enabled: true, showToolbar: true }))
}

// PWA: service worker 등록 (배포 base 경로가 달라도 동작하도록 BASE_URL 기준 상대 등록)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/"
    registerAppServiceWorker(base)
  })
}

// 휴지통 보관 기간(30일)이 지난 항목을 실제로 지운다. 백그라운드 작업이 없는
// 정적 앱이므로 앱이 켜질 때가 유일한 정리 시점이다. 읽기 시점 필터링만으로는
// localStorage 자리가 계속 잡혀 있다.
try {
  purgeExpiredTrash()
} catch {
  // 정리 실패는 앱 시작을 막을 이유가 아니다 — 다음 실행에서 다시 시도한다.
}

const rootEl = document.getElementById("root")
if (!rootEl) throw new Error("root element not found")

const root = ReactDOM.createRoot(rootEl)

function renderRoot(content: React.ReactNode): void {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        {content}
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

if (showFeedbackBoard) {
  renderRoot(<FeedbackBoardRoute />)
} else if (showP3PaceHarness) {
  void import("./testing/P3PaceHarness").then(({ P3PaceHarness }) => {
    renderRoot(<P3PaceHarness />)
  })
} else {
  // ErrorBoundary는 App 바깥에 둔다 — App 자체가 렌더에 실패해도 잡아야 한다.
  renderRoot(<App />)
}
