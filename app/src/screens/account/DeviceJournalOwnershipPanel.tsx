import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import {
  connectUnboundDeviceJournals,
  unboundDeviceJournalCount,
} from "../../domain/journal-store"
import { mono, primaryBtn, secondaryBtn } from "./styles"

export function DeviceJournalOwnershipPanel({ userId }: { readonly userId: string }) {
  const [count, setCount] = React.useState(() => unboundDeviceJournalCount())
  const [confirming, setConfirming] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  if (count === 0) {
    return message === null ? null : (
      <p role="status" data-testid="device-journal-ownership-result" style={{ ...mono, fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>
        {message}
      </p>
    )
  }

  const connect = () => {
    const result = connectUnboundDeviceJournals(userId)
    if (!result.ok) {
      setMessage("기기 일지를 계정에 연결하지 못했어요. 일지는 그대로 두었어요.")
      return
    }
    setCount(unboundDeviceJournalCount())
    setConfirming(false)
    setMessage(`기기 일지 ${result.total}개를 이 계정에 연결했어요.`)
  }

  return (
    <div data-testid="device-journal-ownership" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>이 기기에서 먼저 쓴 일지</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        로그인 전에 쓴 일지 {count}개는 아직 이 기기에만 있어요. 자동으로 계정에 넣거나 서버로 보내지 않았어요.
        공용 기기라면 연결 전까지 다른 사용자도 이 기기 일지를 볼 수 있어요.
      </p>
      {confirming ? (
        <>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>
            {count}개를 지금 로그인한 계정의 일지로 지정할까요? 지정한 뒤에는 다른 계정으로 로그인했을 때 보이지 않아요.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" data-testid="connect-device-journals-confirm" style={{ ...primaryBtn, flex: 1 }} onClick={connect}>
              이 계정에 연결
            </button>
            <button type="button" style={{ ...secondaryBtn, flex: 1 }} onClick={() => setConfirming(false)}>
              나중에
            </button>
          </div>
        </>
      ) : (
        <button type="button" data-testid="connect-device-journals-start" style={secondaryBtn} onClick={() => setConfirming(true)}>
          기기 일지 {count}개 연결하기
        </button>
      )}
      {message !== null && <p role="status" style={{ ...mono, fontSize: 11.5, lineHeight: 1.6, margin: 0 }}>{message}</p>}
    </div>
  )
}
