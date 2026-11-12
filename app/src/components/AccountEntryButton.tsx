// 홈 헤더 계정 진입 버튼 — 로그인 발견성 개선(2026-08-27 검토).
//
// 문제: 로그인·가입 입구가 "더보기 → 계정 연동으로 일지 지키기"에 2단계
// 숨어 있어 사용자가 회원가입·로그인 경로를 인지하지 못했다.
// 개선: 홈 우측 상단에 계정 버튼을 상시 노출한다.
//  - 비로그인: "로그인 · 가입" 및 홈의 큰 가입·로그인 입구
//  - 로그인됨: 사람 아이콘 + "내 계정" 라벨
//  - 계정 기능 OFF 빌드(키 미설정): 아무것도 렌더링하지 않음 — 기존 계약 유지.
// 더보기 안의 데이터 보호 안내 경로는 그대로 둔다(이중 진입점).
import React from "react"
import { UserRound } from "lucide-react"
import { accountFeatureEnabled } from "../domain/account/config"
import { currentUser, onAuthChange } from "../domain/account/auth"

export function AccountEntryButton({ onOpenAccount, prominent = false }: {
  readonly onOpenAccount?: () => void
  readonly prominent?: boolean
}) {
  const enabled = accountFeatureEnabled() && onOpenAccount !== undefined
  const [signedIn, setSignedIn] = React.useState(false)

  React.useEffect(() => {
    if (!enabled) return
    let mounted = true
    let authEventSeen = false
    void currentUser().then((user) => {
      if (mounted && !authEventSeen) setSignedIn(user !== null)
    }).catch(() => { /* The account screen provides the recoverable session check. */ })
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
  if (prominent) return signedIn ? null : <section className="home-account-start" aria-label="회원가입과 로그인">
    <h2>워치 연결은 로그인부터</h2>
    <p>처음이라면 회원가입, 이미 계정이 있다면 로그인하세요.</p>
    <button type="button" className="home-account-start__action" onClick={onOpenAccount}>회원가입 · 로그인</button>
    <p className="home-account-start__optional">가입하지 않아도 일지는 바로 쓸 수 있어요.</p>
  </section>
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
      <span>{signedIn ? "내 계정" : "로그인 · 가입"}</span>
    </button>
  )
}
