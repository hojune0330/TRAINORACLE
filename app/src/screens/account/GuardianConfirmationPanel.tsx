import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import {
  acceptGuardianInvitation,
  createGuardianInvitation,
} from "../../domain/account/guardian-invitations"
import type { GuardianInvitationResult } from "../../domain/account/guardian-invitations"
import { inputStyle, primaryBtn, secondaryBtn } from "./styles"

export function GuardianConfirmationPanel({
  userId,
  onCreate = createGuardianInvitation,
  onAccept = acceptGuardianInvitation,
}: {
  readonly userId: string
  readonly onCreate?: (userId: string) => Promise<GuardianInvitationResult>
  readonly onAccept?: (code: string) => Promise<GuardianInvitationResult>
}) {
  const [createdCode, setCreatedCode] = React.useState<string | null>(null)
  const [receivedCode, setReceivedCode] = React.useState("")
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const create = async () => {
    setBusy(true)
    const result = await onCreate(userId)
    setBusy(false)
    setCreatedCode(result.code ?? null)
    setNotice(result.message)
  }

  const accept = async () => {
    setBusy(true)
    const result = await onAccept(receivedCode)
    setBusy(false)
    setNotice(result.message)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>만 14세 미만 보호자 확인</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
        아이 계정에서 코드를 만든 뒤, 보호자가 <b>다른 사람의 계정으로 로그인</b>해서 아래에 입력해요.
        확인 전에는 아이 계정의 동기화와 공유가 열리지 않아요.
      </p>
      <button type="button" style={primaryBtn} disabled={busy} onClick={() => void create()}>
        보호자 확인 코드 만들기
      </button>
      {createdCode !== null && (
        <output style={{ fontFamily: "var(--mono)", fontSize: 18, textAlign: "center", padding: 10, border: "1px dashed var(--line)" }}>
          {createdCode}
        </output>
      )}
      <label htmlFor="guardian-confirmation-code" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
        받은 보호자 확인 코드
      </label>
      <input
        id="guardian-confirmation-code"
        value={receivedCode}
        onChange={(event) => setReceivedCode(event.target.value)}
        placeholder="ABCD-EFGH-JKLM"
        style={inputStyle}
      />
      <button type="button" style={secondaryBtn} disabled={busy || receivedCode.trim() === ""} onClick={() => void accept()}>
        보호자로 확인하기
      </button>
      {notice !== null && <p role="status" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", margin: 0 }}>{notice}</p>}
    </div>
  )
}
