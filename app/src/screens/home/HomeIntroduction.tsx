import { useEffect, useState } from "react"
import { AppHeading } from "../../components/AppHeading"

export const HOME_INTRODUCTION_KEY = "trainoracle.home-introduction.v1"

/** Only a presentation preference. Never journal, account, plan or analysis state. */
function hasSeenIntroduction(): boolean {
  try { if (window.localStorage.getItem(HOME_INTRODUCTION_KEY) === "seen") return true } catch { /* Try tab storage. */ }
  try { return window.sessionStorage.getItem(HOME_INTRODUCTION_KEY) === "seen" } catch { return false }
}

export function isPlainHomeEntry(location: Pick<Location, "search" | "hash">): boolean {
  if (location.hash) return false
  return [...new URLSearchParams(location.search).keys()].every(key => key === "app" || key.startsWith("utm_"))
}

export function useHomeIntroduction(eligible: boolean): boolean {
  // Keep the introduction stable for this visit; only the next mount is compact.
  const [alreadySeen] = useState(hasSeenIntroduction)
  const expanded = eligible && !alreadySeen
  useEffect(() => {
    if (!expanded) return
    try { window.localStorage.setItem(HOME_INTRODUCTION_KEY, "seen"); return } catch { /* Non-blocking preference. */ }
    try { window.sessionStorage.setItem(HOME_INTRODUCTION_KEY, "seen") } catch { /* The actions still work with storage denied. */ }
  }, [expanded])
  return expanded
}

export function HomeIntroduction({ expanded }: { readonly expanded: boolean }) {
  const [imageFailed, setImageFailed] = useState(false)
  return <section className={`home-hub__intro${expanded ? " home-hub__intro--first" : ""}`} aria-labelledby="home-hub-title">
    {expanded && !imageFailed && <img className="home-hub__identity-art"
      src={`${import.meta.env.BASE_URL || "/"}illustrations/training-analysis-plan-v1.webp`}
      width={112} height={112} alt="" aria-hidden="true" decoding="async" draggable={false}
      onError={() => setImageFailed(true)} />}
    <AppHeading id="home-hub-title" variant="hero" accent={!expanded}>
      {expanded ? <>운동을 분석하고 <br />훈련 계획을 세워요</> : "운동 분석과 훈련 계획"}
    </AppHeading>
  </section>
}
