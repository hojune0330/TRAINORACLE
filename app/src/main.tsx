import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"

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

const rootEl = document.getElementById("root")
if (!rootEl) throw new Error("root element not found")

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
