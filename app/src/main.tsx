import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { purgeExpiredTrash } from "./domain/journal-trash"

// 토큰 단일 소스: 저장소 루트 CSS를 직접 import (이중 정의 금지)
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "./styles/app.css"
import "./styles/plan-beta.css"

if (import.meta.env.DEV) {
  void import("react-grab")
  void import("react-scan").then(({ scan }) => scan({ enabled: true, showToolbar: true }))
}

// PWA: service worker 등록 (배포 base 경로가 달라도 동작하도록 BASE_URL 기준 상대 등록)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/"
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch((err) => console.warn("[SW] register failed:", err))
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

// ErrorBoundary는 App 바깥에 둔다 — App 자체가 렌더에 실패해도 잡아야 한다.
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
