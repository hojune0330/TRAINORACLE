// 데이터 안전 상시 안내 — 소유자 지시(2026-07-24):
// "기기 저장은 맞지만 언제든 (브라우저 정리 등) 이유로 지워질 수 있으니
//  회원 가입·계정 연동으로 일지와 데이터를 지키라고 계속 언급하게 하자."
//
// 원칙:
//  - 영구 닫기 없음 (상시 노출). 대신 작고 조용한 스트립으로 피로 최소화.
//  - 계정 기능 ON: "계정 연동으로 지키기" CTA.
//    계정 기능 OFF(키 미설정 빌드): CTA 없이 사실 고지 + JSON 내보내기 안내.
//  - 협박형 문구 금지 — 사실만 말한다 ("지워질 수 있어요", 손실 카운트다운 없음).
import React from "react"
import { accountFeatureEnabled } from "../domain/account/config"

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
          borderLeft: "3px solid var(--ink-3)",
          background: "var(--surface)",
          padding: "10px 13px",
        }}
      >
        <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.14em" }}>
          내 일지는 지금 이 기기에만 있어요
        </div>
        <div style={{ marginTop: 5, fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", lineHeight: 1.65 }}>
          브라우저 데이터 정리·기기 변경·앱 삭제 때 일지가 지워질 수 있어요.
          {accountOn
            ? " 계정에 연동해 두면 일지와 데이터가 안전하게 보관돼요."
            : " 홈 아래 '안전한 내보내기'로 사본을 보관해 주세요."}
        </div>
        {accountOn && (
          <button
            type="button"
            onClick={onOpenAccount}
            style={{
              marginTop: 8, minHeight: 44, padding: "0 14px",
              fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600,
              color: "var(--bg)", background: "var(--ink)",
              border: 0, borderRadius: 6, cursor: "pointer",
            }}
          >
            계정 연동으로 일지 지키기
          </button>
        )}
      </div>
    </div>
  )
}
