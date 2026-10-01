export type LoungeEntryIntent = {
  readonly requested: boolean
  readonly linkRequested: boolean
  readonly linkToken: string | null
}

export function captureLoungeEntryIntent(href: string, replace: (url: string) => void): LoungeEntryIntent {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const hasLink = fragment.has("lounge_link")
  const rawLink = fragment.get("lounge_link")
  const linkRequested = hasLink || url.searchParams.get("lounge-link-restart") === "1"
  if (hasLink) {
    // Remove only our fragment field: Supabase's own auth callback is untouched.
    fragment.delete("lounge_link")
    url.hash = fragment.toString()
    url.searchParams.set("lounge", "1")
    // This non-sensitive marker survives OAuth. The one-use token never does.
    url.searchParams.set("lounge-link-restart", "1")
    replace(url.pathname + url.search + url.hash)
  }
  return {
    requested: hasLink || url.searchParams.get("lounge") === "1",
    linkRequested,
    linkToken: hasLink && rawLink?.length === 43 && /^[A-Za-z0-9_-]{43}$/u.test(rawLink) ? rawLink : null,
  }
}

let initialIntent: LoungeEntryIntent | undefined
export function loungeEntryIntent(): LoungeEntryIntent {
  // Cached in memory only so React StrictMode initialization cannot consume a
  // fragment twice. No token is placed in history state or browser storage.
  initialIntent ??= typeof window === "undefined"
    ? { requested: false, linkRequested: false, linkToken: null }
    : captureLoungeEntryIntent(window.location.href, url => window.history.replaceState(window.history.state, "", url))
  return initialIntent
}

export function clearPendingLoungeLink(): void {
  if (initialIntent) initialIntent = { ...initialIntent, linkToken: null }
}

// Scrub our sensitive fragment before React effects or the existing auth SDK
// begin. This also happens when either account/lounge feature is disabled.
if (typeof window !== "undefined") loungeEntryIntent()
