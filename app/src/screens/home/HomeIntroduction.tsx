import { useState } from "react"
import { X } from "lucide-react"

// v1 only introduced an empty home. Existing athletes must also see this revision.
export const HOME_INTRODUCTION_KEY = "trainoracle.home-introduction.v2"

/** Only a presentation preference. Never journal, account, plan or analysis state. */
function hasSeenIntroduction(): boolean {
  try { if (window.localStorage.getItem(HOME_INTRODUCTION_KEY) === "seen") return true } catch { /* Try tab storage. */ }
  try { return window.sessionStorage.getItem(HOME_INTRODUCTION_KEY) === "seen" } catch { return false }
}

export function isPlainHomeEntry(location: Pick<Location, "search" | "hash">): boolean {
  if (location.hash) return false
  return [...new URLSearchParams(location.search).keys()].every(key => key === "app" || key.startsWith("utm_"))
}

export function useHomeIntroduction(eligible: boolean) {
  // Keep the short introduction stable until dismissed, without waiting or moving focus.
  const [alreadySeen] = useState(hasSeenIntroduction)
  const [dismissed, setDismissed] = useState(false)
  const expanded = eligible && !alreadySeen && !dismissed
  const dismiss = () => {
    setDismissed(true)
    try { window.localStorage.setItem(HOME_INTRODUCTION_KEY, "seen"); return } catch { /* Non-blocking preference. */ }
    try { window.sessionStorage.setItem(HOME_INTRODUCTION_KEY, "seen") } catch { /* The actions still work with storage denied. */ }
  }
  // Rendering below the fold is not proof that the athlete has read the introduction.
  return { expanded, dismiss }
}

export function HomeIdentityArtwork({ size = 48 }: { readonly size?: 48 | 64 }) {
  const [imageFailed, setImageFailed] = useState(false)
  if (imageFailed) return null
  return <img className="home-hub__identity-art"
    src={`${import.meta.env.BASE_URL || "/"}illustrations/training-analysis-plan-v1.webp`}
    width={size} height={size} alt="" aria-hidden="true" decoding="async" draggable={false}
    onError={() => setImageFailed(true)} />
}

/** A one-time, optional line after today's actions, never an opening gate or result. */
export function HomeIntroduction({ onDismiss }: { readonly onDismiss: () => void }) {
  return <section className="home-hub__introduction" aria-label="앱 소개">
    <p>훈련 계획을 받아보고, 러닝 일지를 꾸며요.</p>
    <button type="button" onClick={onDismiss} aria-label="앱 소개 닫기" title="소개 닫기"><X size={18} aria-hidden="true" /></button>
  </section>
}
