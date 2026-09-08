import { activeLocalAccount } from "./local-journal-ownership"

export const ACCOUNT_AUTH_STATE_EVENT = "trainoracle:account-auth-state-changed"
type SignedOutState = "RESOLVING" | "GUEST" | "FAILED"
let signedOutState: SignedOutState = "RESOLVING"

// A missing owner is not proof that authentication successfully resolved to guest.
export function accountAuthState(): SignedOutState | "ACCOUNT" {
  return activeLocalAccount() === null ? signedOutState : "ACCOUNT"
}

export function setAccountAuthState(state: SignedOutState) {
  signedOutState = state
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_AUTH_STATE_EVENT))
}
