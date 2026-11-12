import React from "react"
import { UserRound } from "lucide-react"
import { accountFeatureEnabled } from "../domain/account/config"
import { currentUser, onAuthChange } from "../domain/account/auth"

export type AccountEntryMode = "login" | "signup"

export function AccountEntryActions({ signedIn, onOpenAccount }: {
  readonly signedIn: boolean
  readonly onOpenAccount: (mode?: AccountEntryMode) => void
}) {
  if (signedIn) return <button type="button" className="training-home__account" onClick={() => onOpenAccount()}>
    <UserRound aria-hidden="true" size={16} /><span>내 계정</span>
  </button>
  return <div className="account-entry-actions" role="group" aria-label="계정">
    <button type="button" className="training-home__account" onClick={() => onOpenAccount("login")}>로그인</button>
    <button type="button" className="training-home__account" onClick={() => onOpenAccount("signup")}>회원가입</button>
  </div>
}

export function AccountEntryButton({ onOpenAccount }: {
  readonly onOpenAccount?: (mode?: AccountEntryMode) => void
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

  if (!enabled || !onOpenAccount) return null
  return <AccountEntryActions signedIn={signedIn} onOpenAccount={onOpenAccount} />
}
