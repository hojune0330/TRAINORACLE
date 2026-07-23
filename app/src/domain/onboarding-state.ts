const FIRST_VISIT_DISMISSED_KEY = "trainoracle.onboarding.dismissed.v1"

export function hasDismissedFirstVisit(): boolean {
  try {
    return window.localStorage.getItem(FIRST_VISIT_DISMISSED_KEY) === "true"
  } catch {
    return false
  }
}

export function dismissFirstVisit(): void {
  try {
    window.localStorage.setItem(FIRST_VISIT_DISMISSED_KEY, "true")
  } catch {
  }
}
