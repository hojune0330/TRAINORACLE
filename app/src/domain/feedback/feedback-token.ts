const TOKEN_KEY = "trainoracle.feedback.receipt.v1"

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
}

export function feedbackReceiptToken(): string {
  const stored = window.localStorage.getItem(TOKEN_KEY)
  if (stored !== null && /^[0-9a-f]{64}$/u.test(stored)) return stored
  const token = newToken()
  window.localStorage.setItem(TOKEN_KEY, token)
  return token
}
