import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"

// 토큰 단일 소스: 저장소 루트 CSS를 직접 import (이중 정의 금지)
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "./styles/app.css"

// PWA: service worker 등록 (배포 base 경로가 달라도 동작하도록 BASE_URL 기준 상대 등록)
if ("serviceWorker" in navigator && !window.location.search.includes("uitest")) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "/"
    navigator.serviceWorker
      .register(`${base}sw.js`, { scope: base })
      .catch((err) => console.warn("[SW] register failed:", err))
  })
}

// ?uitest: 저장 계층 자가검증 (런타임 증거 [JSTORE])
// ?uitest=seed: 자가검증 후 시드 2건을 남겨 홈 '이 기기의 일지' 렌더 증거([HOMEJ]) 확보.
// 시드가 렌더 전에 준비되도록 자가검증을 먼저 await 한 뒤 렌더한다.
async function bootstrap() {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    if (params.has("uitest")) {
      const m = await import("./domain/journal-store")
      m.runStoreSelfTest({ seed: params.get("uitest") === "seed" })
    }
  }

  const rootEl = document.getElementById("root")
  if (!rootEl) throw new Error("root element not found")

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()
