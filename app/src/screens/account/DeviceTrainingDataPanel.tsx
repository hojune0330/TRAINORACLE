import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import {
  connectDeviceTrainingDataToAccount,
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
  if (summary.plan.kind === "account_local") parts.push("이 계정용으로 구분된 기기 훈련 계획 1개")
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

export function DeviceTrainingDataPanel({
  userId,
  connectData = connectDeviceTrainingDataToAccount,
}: {
  readonly userId: string
  readonly connectData?: typeof connectDeviceTrainingDataToAccount
}) {
  const [summary, setSummary] = React.useState(() => inspectDeviceTrainingDataConnection(userId))
  const [confirming, setConfirming] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  if (!hasDeviceData(summary)) {
    return message === null ? null : (
      <p role="status" data-testid="device-training-data-result" style={{ ...mono, fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>
        {message}
      </p>
    )
  }

  const connect = async () => {
    setConnecting(true)
    const result = await connectData(userId).catch(() => null)
    if (result === null) {
      setMessage("온라인 저장 상태를 확인하지 못했어요. 기기의 원본은 그대로 두었어요.")
      setConfirming(false)
      setConnecting(false)
      return
    }
    const messages: string[] = []
    if (result.planStorage === "stored_online") {
      messages.push("훈련 계획 1개를 온라인 계정 보관함에 저장했어요. 다시 사용하려면 계획 화면에서 확인하고 선택하세요")
    } else if (result.planStorage === "pending") {
      messages.push("훈련 계획은 온라인 전송을 기다리고 있어요. 기기의 원본은 그대로 두었어요")
    } else if (result.planStorage !== "none") {
      messages.push("훈련 계획을 온라인에 저장하지 못했어요. 기기의 원본은 그대로 두었어요")
    }
    if (result.records === "connected") messages.push(`선수 기록 ${result.connectedRecords}개를 이 기기에서 계정용으로 구분했어요`)
    if (result.decorations === "connected") messages.push("스티커와 꾸미기를 이 기기에서 계정용으로 구분했어요")
    if (result.plan === "conflict") messages.push("계정에 계획이 있어 기기 계획은 그대로 두었어요")
    if (result.records === "conflict") messages.push("계정에 기록이 있어 기기 기록은 그대로 두었어요")
    if (result.decorations === "conflict") messages.push("계정에 꾸미기 이력이 있어 기기 꾸미기는 그대로 두었어요")
    if (!result.ok) messages.push("연결하지 못한 데이터는 기기에 그대로 남겼어요")
    setMessage(messages.join(". "))
    setSummary(inspectDeviceTrainingDataConnection(userId))
    setConfirming(false)
    setConnecting(false)
  }

  return (
    <div data-testid="device-training-data" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>로그인 전에 만든 데이터</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        이 기기에 {description(summary)} 데이터가 남아 있어요. 훈련 계획은 먼저 온라인 계정 보관함에 저장하고,
        기록과 꾸미기는 이 기기에서 계정별로 구분해요. 같은 종류의 데이터는 덮어쓰지 않아요.
      </p>
      {confirming ? (
        <>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>
            훈련 계획은 온라인 계정에 보관하고, 기기의 기록과 꾸미기는 이 계정용으로 구분할까요?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-testid="connect-device-training-confirm" style={{ ...primaryBtn, flex: 1 }} onClick={() => void connect()} disabled={connecting}>
              {connecting ? "저장 확인 중" : "온라인 보관 및 연결"}
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
