import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { CanonicalJournalBoundary } from "./components/CanonicalJournalBoundary"
import { registerAppServiceWorker } from "./domain/pwa-update"
import { FeedbackBoardRoute } from "./screens/FeedbackBoardRoute"
import { TrainingLexiconRoute } from "./screens/TrainingLexiconRoute"
import { LT_PILOT_MULTI_PLAN_RUNTIME_V3 } from "./domain/lt-pilot-runtime-v3"
import { captureEmailAuthCallbackFromUrl } from "./domain/account/email-auth-callback"
import { captureOAuthAuthCallbackFromUrl } from "./domain/account/oauth-auth-callback"
import { retireSharedOriginAuthCredentials } from "./domain/account/auth-origin"

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
import "./styles/training-content.css"
import "./styles/training-lexicon.css"
import "./styles/compact-tabs.css"
import "./styles/emphasis-system.css"
import "./styles/app-presentation.css"
import "./styles/selection-system.css"
import "./styles/category-cards.css"
import "./styles/date-controls.css"

const showP3PaceHarness = import.meta.env.DEV
  && new URLSearchParams(window.location.search).get("p3-pace-fixture") === "1"
const showFeedbackBoard = new URLSearchParams(window.location.search).get("feedback") === "1"
const showTrainingLexicon = new URLSearchParams(window.location.search).get("terms") === "1"

// Email confirmation links contain a one-time token hash. Remove it from the
// visible URL/history before rendering, then let the account screen exchange the
// in-memory value exactly once.
captureEmailAuthCallbackFromUrl()
captureOAuthAuthCallbackFromUrl()

// GitHub Pages project paths share one origin with every other project under
// the account. Retire credentials from that origin; journals/plans are retained.
try {
  retireSharedOriginAuthCredentials(window.localStorage, window.sessionStorage, window.location.hostname)
} catch {
  // Storage denial must not stop the local-only app from opening.
}

// Diagnostic overlays can cover mobile navigation; enable only on request.
if (import.meta.env.DEV && !showP3PaceHarness && new URLSearchParams(window.location.search).get("devtools") === "1") {
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

if (showTrainingLexicon) {
  renderRoot(<TrainingLexiconRoute />)
} else if (showFeedbackBoard) {
  renderRoot(<FeedbackBoardRoute />)
} else if (showP3PaceHarness) {
  void import("./testing/P3PaceHarness").then(({ P3PaceHarness }) => {
    renderRoot(<P3PaceHarness />)
  })
} else {
  // ErrorBoundary는 App 바깥에 둔다 — App 자체가 렌더에 실패해도 잡아야 한다.
  renderRoot(<CanonicalJournalBoundary><App multiPlanRuntime={LT_PILOT_MULTI_PLAN_RUNTIME_V3} /></CanonicalJournalBoundary>)
}
