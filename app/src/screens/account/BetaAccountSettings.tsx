import React from "react"
import { SectionLb } from "../../components/JournalPrimitives"
import {
  requestServerAccountDeletion,
  savePrivateProfile,
} from "../../domain/account/account-service"
import type {
  AccountActionResult,
  SaveProfileInput,
} from "../../domain/account/account-service"
import { profileFromBirthDate } from "../../domain/account/profile"
import type { AccountLegalDocument } from "../../domain/account/config"
import { inputStyle, primaryBtn, secondaryBtn } from "./styles"
import { formatBirthDateInput } from "./birth-date-input"

type BetaAccountSettingsProps = {
  readonly userId: string
  readonly today: string
  readonly legalDocuments: {
    readonly privacyPolicy: AccountLegalDocument
    readonly termsOfService: AccountLegalDocument
  }
  readonly initialPrivacyAcknowledged?: boolean
  readonly initialTermsAcknowledged?: boolean
  readonly profileSetupComplete?: boolean
  readonly completionOnly?: boolean
  readonly onCompleted?: () => void
  readonly onSaveProfile?: (input: SaveProfileInput) => Promise<AccountActionResult>
  readonly onRequestDeletion?: (userId: string) => Promise<AccountActionResult>
}

export function BetaAccountSettings({
  userId,
  today,
  legalDocuments,
  initialPrivacyAcknowledged = false,
  initialTermsAcknowledged = false,
  profileSetupComplete = false,
  completionOnly = false,
  onCompleted,
  onSaveProfile = savePrivateProfile,
  onRequestDeletion = requestServerAccountDeletion,
}: BetaAccountSettingsProps) {
  const [birthDate, setBirthDate] = React.useState("")
  const [ageMessage, setAgeMessage] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [deletionConfirming, setDeletionConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [privacyAcknowledged, setPrivacyAcknowledged] = React.useState(initialPrivacyAcknowledged)
  const [termsAcknowledged, setTermsAcknowledged] = React.useState(initialTermsAcknowledged)

  const save = async () => {
    setNotice(null)
    try {
      const profile = profileFromBirthDate(birthDate, today)
      if (profile.ageBand === "UNDER_14") {
        setAgeMessage("온라인 계정은 만 14세부터 만들 수 있어요. 기기 일지와 훈련 계획은 그대로 사용할 수 있어요.")
        return
      }
      setAgeMessage("계정 기능을 사용할 수 있는 나이예요.")
    } catch (error) {
      if (error instanceof RangeError) {
        setNotice("생년월일을 확인해 주세요.")
        return
      }
      throw error
    }
    setBusy(true)
    const result = await onSaveProfile({
      userId,
      birthDate,
      privacyPolicyVersion: legalDocuments.privacyPolicy.version,
      termsOfServiceVersion: legalDocuments.termsOfService.version,
    })
    setBusy(false)
    setNotice(result.message)
    if (result.ok) onCompleted?.()
  }

  const requestDeletion = async () => {
    setBusy(true)
    const result = await onRequestDeletion(userId)
    setBusy(false)
    setDeletionConfirming(false)
    setNotice(result.message)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLb>{completionOnly ? "가입 마무리" : "계정 정보와 개인정보"}</SectionLb>
      {profileSetupComplete ? (
        <p style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
          가입에 필요한 나이 확인과 필수 약관 동의를 저장했어요. 생년월일은 나이 확인에만 쓰고 코치, 분석, 포인트에는 보내지 않아요.
        </p>
      ) : (
        <>
          <label htmlFor="account-birth-date" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>생년월일</label>
          <input
            id="account-birth-date"
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            maxLength={10}
            placeholder="예: 2000-01-01"
            value={birthDate}
            onChange={(event) => setBirthDate(formatBirthDateInput(event.target.value))}
            style={inputStyle}
          />
          <p style={{ fontFamily: "var(--sans)", fontSize: 11.5, lineHeight: 1.6, color: "var(--ink-3)", margin: 0 }}>
            생년월일은 나이 확인에만 쓰고 코치, 분석, 포인트에는 보내지 않아요.
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)" }}>
            <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} />
            <span><a href={legalDocuments.privacyPolicy.url} target="_blank" rel="noreferrer">개인정보 처리방침</a>을 읽었어요.</span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)" }}>
            <input type="checkbox" checked={termsAcknowledged} onChange={(event) => setTermsAcknowledged(event.target.checked)} />
            <span><a href={legalDocuments.termsOfService.url} target="_blank" rel="noreferrer">이용약관</a>을 읽었어요.</span>
          </label>
          <button type="button" style={primaryBtn} disabled={busy || birthDate === "" || !privacyAcknowledged || !termsAcknowledged} onClick={() => void save()}>
            계정 정보 저장
          </button>
        </>
      )}
      {ageMessage !== null && <p role="status" style={{ fontFamily: "var(--sans)", fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>{ageMessage}</p>}

      {!completionOnly && (
        <>
          <SectionLb>계정 삭제</SectionLb>
          <p style={{ fontFamily: "var(--sans)", fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)", margin: 0 }}>
            요청하는 즉시 계정 접근을 막고 서버와 백업 데이터는 30일 안에 삭제해요.
          </p>
          {deletionConfirming ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button type="button" style={primaryBtn} disabled={busy} onClick={() => void requestDeletion()}>
                네, 계정 삭제를 요청할게요
              </button>
              <button type="button" style={secondaryBtn} disabled={busy} onClick={() => setDeletionConfirming(false)}>
                그만두기
              </button>
            </div>
          ) : (
            <button type="button" style={secondaryBtn} onClick={() => setDeletionConfirming(true)}>
              계정 삭제 요청
            </button>
          )}
        </>
      )}
      {notice !== null && <p role="status" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", margin: 0 }}>{notice}</p>}
    </div>
  )
}
