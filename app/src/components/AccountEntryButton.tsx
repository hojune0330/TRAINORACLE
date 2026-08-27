// 홈 헤더 계정 진입 버튼 — 로그인 발견성 개선(2026-08-27 검토).
//
// 문제: 로그인·가입 입구가 "더보기 → 계정 연동으로 일지 지키기"에 2단계
// 숨어 있어 사용자가 회원가입·로그인 경로를 인지하지 못했다.
// 개선: 홈 우측 상단에 계정 버튼을 상시 노출한다.
//  - 비로그인: 사람 아이콘 + "로그인" 라벨
//  - 로그인됨: 아이콘만 ("내 계정")
//  - 계정 기능 OFF 빌드(키 미설정): 아무것도 렌더링하지 않음 — 기존 계약 유지.
// 더보기 안의 데이터 보호 안내 경로는 그대로 둔다(이중 진입점).
import React from "react"
import { UserRound } from "lucide-react"
import { accountFeatureEnabled } from "../domain/account/config"
import { currentUser, onAuthChange } from "../domain/account/auth"

export function AccountEntryButton({ onOpenAccount }: {
  readonly onOpenAccount?: () => void
}) {
  const enabled = accountFeatureEnabled() && onOpenAccount !== undefined
  const [signedIn, setSignedIn] = React.useState(false)

  React.useEffect(() => {
    if (!enabled) return
    let mounted = true
    let authEventSeen = false
    void currentUser().then((user) => {
      if (mounted && !authEventSeen) setSignedIn(user !== null)
    })
    const unsubscribe = onAuthChange((user) => {
      authEventSeen = true
      setSignedIn(user !== null)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [enabled])

  if (!enabled) return null
  const label = signedIn ? "내 계정" : "로그인 또는 가입"
  return (
    <button
      type="button"
      className={`training-home__account${signedIn ? " training-home__account--signed-in" : ""}`}
      onClick={onOpenAccount}
      aria-label={label}
      title={label}
    >
      <UserRound aria-hidden="true" size={18} />
      {!signedIn && <span>로그인</span>}
    </button>
  )
}
