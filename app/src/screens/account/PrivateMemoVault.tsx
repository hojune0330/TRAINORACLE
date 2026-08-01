import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import { createRecoveryCode, isValidRecoveryCode } from "../../domain/account/private-note-crypto"
import { saveSessionRecoveryCode } from "../../domain/account/private-note-sync"
import { inputStyle, primaryBtn, secondaryBtn } from "./styles"

type PrivateMemoVaultProps = {
  readonly onSaveCode?: (code: string) => boolean
}

export function PrivateMemoVault({ onSaveCode = saveSessionRecoveryCode }: PrivateMemoVaultProps) {
  const [existingCode, setExistingCode] = React.useState("")
  const [createdCode, setCreatedCode] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const create = () => {
    const code = createRecoveryCode()
    setCreatedCode(code)
    setNotice(onSaveCode(code)
      ? "이 브라우저 세션에서 나만의 메모를 암호화해 동기화할 수 있어요."
      : "이 브라우저에 복구 코드를 준비하지 못했어요.")
  }

  const unlock = () => {
    const normalized = existingCode.trim().toUpperCase()
    if (!isValidRecoveryCode(normalized)) {
      setNotice("복구 코드 형식을 확인해 주세요.")
      return
    }
    setNotice(onSaveCode(normalized)
      ? "이 브라우저 세션에서 나만의 메모를 열 수 있어요."
      : "이 브라우저에 복구 코드를 준비하지 못했어요.")
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionLb>나만의 메모 암호화</SectionLb>
      <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.65, color: "var(--ink-2)", margin: 0 }}>
        나만의 메모는 기기에서 암호화하고 서버에는 암호문만 저장해요. 복구 코드를 잃으면 <b>서비스 운영자도 대신 복구할 수 없어요.</b>
      </p>
      <button type="button" style={primaryBtn} onClick={create}>새 복구 코드 만들기</button>
      {createdCode !== null && (
        <output data-testid="recovery-code" style={{ fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.7, overflowWrap: "anywhere", padding: 10, border: "1px dashed var(--line)" }}>
          {createdCode}
        </output>
      )}
      <label htmlFor="private-recovery-code" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
        기존 복구 코드
      </label>
      <input
        id="private-recovery-code"
        value={existingCode}
        onChange={(event) => setExistingCode(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />
      <button type="button" style={secondaryBtn} disabled={existingCode.trim() === ""} onClick={unlock}>
        이 세션에서 메모 열기
      </button>
      {notice !== null && <p role="status" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", margin: 0 }}>{notice}</p>}
    </div>
  )
}
