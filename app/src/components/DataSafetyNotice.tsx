// General storage help stays available; actual save failures and pending states
// are shown by their owning forms and must not be placed in this disclosure.
import React from "react"
import { accountFeatureEnabled } from "../domain/account/config"
import { InfoDisclosure } from "./InfoDisclosure"

export function DataSafetyNotice({ onOpenAccount }: {
  readonly onOpenAccount?: () => void
}) {
  const accountOn = accountFeatureEnabled() && onOpenAccount !== undefined
  return (
    <div style={{ padding: "16px 20px 0" }}>
      <div
        data-testid="data-safety-notice"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          padding: "10px 13px",
        }}
      >
        <InfoDisclosure title="내 일지는 어디에 보관되나요?">
        <p>
          로그인하지 않은 기록은 이 기기에 남아요. 브라우저 데이터 정리·기기 변경·앱 삭제 때 지워질 수 있어요.
          {accountOn
            ? " 계정 저장을 사용할 때는 ‘계정 저장 완료’로 확인된 기록이 계정에 보관돼요."
            : " 백업·복원에서 사본을 보관해 주세요."}
        </p>
        {accountOn && (
          <button
            type="button"
            onClick={onOpenAccount}
            style={{
              marginTop: 8, minHeight: 44, padding: "0 14px",
              fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
              color: "var(--bg)", background: "var(--ink)",
              border: 0, borderRadius: "var(--r-md)", cursor: "pointer",
            }}
          >
            계정 저장 상태 확인
          </button>
        )}
        </InfoDisclosure>
      </div>
    </div>
  )
}
