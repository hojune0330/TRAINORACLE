import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import {
  acceptSupportInvitation,
  createSupportInvitation,
} from "../../domain/account/support-invitations"
import type { InvitationActionResult } from "../../domain/account/support-invitations"
import { inputStyle, primaryBtn, secondaryBtn } from "./styles"

type CoachSupportPanelProps = {
  readonly userId: string
  readonly today: string
  readonly onCreateInvitation?: (userId: string, seasonEndsOn: string) => Promise<InvitationActionResult>
  readonly onAcceptInvitation?: (code: string) => Promise<InvitationActionResult>
}

export function CoachSupportPanel({
  userId,
  today,
  onCreateInvitation = createSupportInvitation,
  onAcceptInvitation = acceptSupportInvitation,
}: CoachSupportPanelProps) {
  const [seasonEndsOn, setSeasonEndsOn] = React.useState("")
  const [receivedCode, setReceivedCode] = React.useState("")
  const [createdCode, setCreatedCode] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  const create = async () => {
    setBusy(true)
    const result = await onCreateInvitation(userId, seasonEndsOn)
    setBusy(false)
    setCreatedCode(result.code ?? null)
    setNotice(result.message)
  }

  const accept = async () => {
    setBusy(true)
    const result = await onAcceptInvitation(receivedCode)
    setBusy(false)
    setNotice(result.message)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>코치·지원자 연결</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
        사용자가 초대한 사람과 기록을 나눌 수 있어요. TrainOracle이 자격을 확인한 사람이 아니므로 항상 <b>자격 미확인</b>으로 표시해요. 나만의 메모는 공유하지 않아요.
      </p>
      <label htmlFor="support-season-end" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
        시즌 종료일
      </label>
      <input
        id="support-season-end"
        type="date"
        min={today}
        value={seasonEndsOn}
        onChange={(event) => setSeasonEndsOn(event.target.value)}
        style={inputStyle}
      />
      <button type="button" style={primaryBtn} disabled={busy || seasonEndsOn === ""} onClick={() => void create()}>
        코치·지원자 초대 코드 만들기
      </button>
      {createdCode !== null && (
        <output style={{ fontFamily: "var(--mono)", fontSize: 18, textAlign: "center", padding: 10, border: "1px dashed var(--line)" }}>
          {createdCode}
        </output>
      )}
      <label htmlFor="support-invite-code" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
        받은 초대 코드
      </label>
      <input
        id="support-invite-code"
        value={receivedCode}
        onChange={(event) => setReceivedCode(event.target.value)}
        placeholder="ABCD-EFGH-IJKL"
        style={inputStyle}
      />
      <button type="button" style={secondaryBtn} disabled={busy || receivedCode.trim() === ""} onClick={() => void accept()}>
        초대 코드로 연결
      </button>
      {notice !== null && <p role="status" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", margin: 0 }}>{notice}</p>}
    </div>
  )
}
