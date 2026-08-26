import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import {
  connectDeviceTrainingData,
  inspectDeviceTrainingDataConnection,
} from "../../domain/account/device-training-data-connection"
import type { DeviceTrainingDataConnectionSummary } from "../../domain/account/device-training-data-connection"
import { mono, primaryBtn, secondaryBtn } from "./styles"

function hasDeviceData(summary: DeviceTrainingDataConnectionSummary): boolean {
  return summary.plan.kind !== "none" || summary.records.kind !== "none" || summary.decorations.kind !== "none"
}

function description(summary: DeviceTrainingDataConnectionSummary): string {
  const parts: string[] = []
  if (summary.plan.kind === "available") parts.push("훈련 계획 1개")
  if (summary.records.kind === "available") parts.push(`선수 기록 ${summary.records.count}개`)
  if (summary.decorations.kind === "available") parts.push("스티커와 꾸미기")
  if (summary.plan.kind === "conflict") parts.push("계정 계획과 겹치는 기기 계획")
  if (summary.records.kind === "conflict") parts.push("계정 기록과 겹치는 기기 기록")
  if (summary.decorations.kind === "conflict") parts.push("계정 꾸미기와 겹치는 기기 꾸미기")
  if (summary.plan.kind === "invalid" || summary.records.kind === "invalid" || summary.decorations.kind === "invalid") {
    parts.push("확인이 필요한 기기 데이터")
  }
  return parts.join(" · ")
}

export function DeviceTrainingDataPanel({ userId }: { readonly userId: string }) {
  const [summary, setSummary] = React.useState(() => inspectDeviceTrainingDataConnection(userId))
  const [confirming, setConfirming] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  if (!hasDeviceData(summary)) {
    return message === null ? null : (
      <p role="status" data-testid="device-training-data-result" style={{ ...mono, fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>
        {message}
      </p>
    )
  }

  const connect = () => {
    const result = connectDeviceTrainingData(userId)
    const messages: string[] = []
    if (result.plan === "connected") messages.push("기기 훈련 계획을 연결했어요")
    if (result.records === "connected") messages.push(`선수 기록 ${result.connectedRecords}개를 연결했어요`)
    if (result.decorations === "connected") messages.push("스티커와 꾸미기를 연결했어요")
    if (result.plan === "conflict") messages.push("계정에 계획이 있어 기기 계획은 그대로 두었어요")
    if (result.records === "conflict") messages.push("계정에 기록이 있어 기기 기록은 그대로 두었어요")
    if (result.decorations === "conflict") messages.push("계정에 꾸미기 이력이 있어 기기 꾸미기는 그대로 두었어요")
    if (!result.ok) messages.push("연결하지 못한 데이터는 기기에 그대로 남겼어요")
    setMessage(messages.join(". "))
    setSummary(inspectDeviceTrainingDataConnection(userId))
    setConfirming(false)
  }

  return (
    <div data-testid="device-training-data" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>로그인 전에 만든 데이터</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        이 기기에 {description(summary)} 데이터가 남아 있어요. 자동으로 계정에 넣지 않았어요.
        계정에 이미 같은 종류의 데이터가 있으면 덮어쓰지 않고 기기 데이터도 그대로 보존해요.
      </p>
      {confirming ? (
        <>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>
            연결한 계획, 기록, 꾸미기는 이 계정에서만 보여요. 지금 연결할까요?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-testid="connect-device-training-confirm" style={{ ...primaryBtn, flex: 1 }} onClick={connect}>
              이 계정에 연결
            </button>
            <button type="button" style={{ ...secondaryBtn, flex: 1 }} onClick={() => setConfirming(false)}>
              나중에
            </button>
          </div>
        </>
      ) : (
        <button type="button" data-testid="connect-device-training-start" style={secondaryBtn} onClick={() => setConfirming(true)}>
          기기 데이터 확인하기
        </button>
      )}
      {message !== null && <p role="status" style={{ ...mono, fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>{message}</p>}
    </div>
  )
}
