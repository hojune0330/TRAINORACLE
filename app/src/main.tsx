import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"

// 토큰 단일 소스: 저장소 루트 CSS를 직접 import (이중 정의 금지)
import "../../colors_and_type.css"
import "../../colors_and_type_journal.css"
import "./styles/app.css"

const rootEl = document.getElementById("root")
if (!rootEl) throw new Error("root element not found")

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
