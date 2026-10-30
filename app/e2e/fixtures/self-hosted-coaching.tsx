import React from "react"
import { createRoot } from "react-dom/client"
import { SelfHostedCoachingPanel } from "../../src/components/SelfHostedCoachingPanel"
import { exampleCoachingExplanation, exampleCoachingStatus } from "../../src/components/SelfHostedCoachingPanel.test-fixtures"
import { COACHING_PURPOSE_VERSION, type CoachingTransport } from "../../src/domain/coaching-self-hosted"
import "../../../colors_and_type.css"

// Vite development fixture only; never connected to an account or inference server.
if (import.meta.env.DEV) {
  let revision = 0
  const send: CoachingTransport = async (_owner, request) => ({ ok: true, data: request.action === "status" ? exampleCoachingStatus
    : request.action === "infer" ? exampleCoachingExplanation
      : { consent: { revision: ++revision, active: request.action === "consent", purposeVersion: COACHING_PURPOSE_VERSION } } })
  createRoot(document.getElementById("root")!).render(<main style={{ maxWidth: 620, margin: "24px auto", padding: 16 }}>
    <p>개발 검수용 합성 예시 · 실제 계정·Garmin 승인·모델 연결 아님</p>
    <SelfHostedCoachingPanel ownerId="synthetic-preview-owner" transport={send} onReviewJournal={() => alert("기존 일지 이동 검수")} onReviewPlan={() => alert("기존 계획 이동 검수")} />
  </main>)
}
