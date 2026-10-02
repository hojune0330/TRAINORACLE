import React from "react"
import { isValidIsoDate } from "../../domain/dates"
import { decorationCatalogItem } from "../../domain/decoration-catalog"
import type { DecorationCatalogItem } from "../../domain/decoration-catalog"
import {
  activeDecorationStorageKeyV1,
  activeDecorationStorageKeyV2,
  activeDecorationStorageKeyV3,
  createEmptyDecorationState,
  DECORATION_STATE_EVENT,
  parseStoredDecorationStateV3,
  type DecorationState,
} from "../../domain/decorations"
import { journalDecorationItems } from "../../domain/journal-decoration-state"
import {
  ACCOUNT_DECORATION_EVENT,
  accountDecorationStatus,
  accountDecorationsEnabled,
  readAccountDecorationState,
} from "../../domain/account/account-decoration-service"
import { onLocalJournalScopeChange } from "../../domain/account/local-journal-ownership"
import { LOCAL_JOURNALS_CHANGED } from "../../domain/journal-change-events"
import { loadEntries } from "../../domain/journal-store"
import "./journal-decoration-preview.css"

function readTrustedDecorationState(): DecorationState | null {
  if (typeof window === "undefined") return null
  if (accountDecorationsEnabled()) {
    const status = accountDecorationStatus()
    if (status === "EMPTY") return createEmptyDecorationState()
    if (status === "READY") return readAccountDecorationState()
    return null
  }
  try {
    const storage = window.localStorage
    const current = storage.getItem(activeDecorationStorageKeyV3())
    if (current !== null) return parseStoredDecorationStateV3(current)
    // Do not trigger the legacy migration from a read-only preview. Until another
    // explicit decoration surface migrates it, an old or unreadable state is unknown.
    if (storage.getItem(activeDecorationStorageKeyV2()) !== null
      || storage.getItem(activeDecorationStorageKeyV1()) !== null) return null
    return createEmptyDecorationState()
  } catch {
    return null
  }
}

function isEligibleMotif(item: DecorationCatalogItem): boolean {
  return item.category === "STICKER" || item.category === "STAMP" || item.category === "EMOJI_STICKER"
}

/** Select the last rendered, owned non-text motif for an actual saved journal date. */
export function selectJournalDecorationPreview(
  state: DecorationState | null,
  date: string,
  activeDates: ReadonlySet<string>,
): DecorationCatalogItem | null {
  if (state === null || !isValidIsoDate(date) || !activeDates.has(date)) return null
  const owned = new Set(state.ownedItemIds)
  const items = journalDecorationItems(state, date)
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const placement = items[index]
    if (placement === undefined || placement.itemId === "TEXT_STICKER") continue
    const item = decorationCatalogItem(placement.itemId)
    if (item !== undefined && owned.has(item.id) && isEligibleMotif(item)) return item
  }
  return null
}

/** Load one trusted snapshot per surface; callers project dates locally without per-cell reads. */
export function useJournalDecorationSnapshot(): DecorationState | null {
  const [state, setState] = React.useState<DecorationState | null>(readTrustedDecorationState)
  React.useEffect(() => {
    const refresh = () => setState(readTrustedDecorationState())
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener(DECORATION_STATE_EVENT, refresh)
    window.addEventListener(ACCOUNT_DECORATION_EVENT, refresh)
    const unsubscribe = onLocalJournalScopeChange(refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(DECORATION_STATE_EVENT, refresh)
      window.removeEventListener(ACCOUNT_DECORATION_EVENT, refresh)
      unsubscribe()
    }
  }, [])
  return state
}

export function useJournalDecorationPreviews(activeDates: ReadonlySet<string>): ReadonlyMap<string, DecorationCatalogItem> {
  const state = useJournalDecorationSnapshot()
  return React.useMemo(() => {
    if (state === null) return new Map<string, DecorationCatalogItem>()
    const result = new Map<string, DecorationCatalogItem>()
    for (const date of activeDates) {
      const item = selectJournalDecorationPreview(state, date, activeDates)
      if (item !== null) result.set(date, item)
    }
    return result
  }, [activeDates, state])
}

export function JournalDecorationPreview({ item, className = "" }: {
  readonly item: DecorationCatalogItem | null | undefined
  readonly className?: string
}) {
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => { setFailed(false) }, [item?.id])
  if (item === null || item === undefined || !isEligibleMotif(item)) return null
  const classes = `journal-decoration-preview ${className}`.trim()
  if (item.category === "EMOJI_STICKER") {
    return <span className={classes} aria-hidden="true">{item.emoji}</span>
  }
  if (failed) return null
  return <img className={classes} src={`${import.meta.env.BASE_URL}${item.assetPath}`} alt="" width={16} height={16} draggable="false" onError={() => setFailed(true)} />
}

function loadActiveSavedDates(): ReadonlySet<string> {
  try {
    return new Set(loadEntries().map((entry) => entry.date).filter(isValidIsoDate))
  } catch {
    return new Set()
  }
}

function useActiveSavedDates(): ReadonlySet<string> {
  const [dates, setDates] = React.useState<ReadonlySet<string>>(loadActiveSavedDates)
  React.useEffect(() => {
    const refresh = () => setDates(loadActiveSavedDates())
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener(LOCAL_JOURNALS_CHANGED, refresh)
    window.addEventListener("trainoracle:account-journals-changed", refresh)
    const unsubscribe = onLocalJournalScopeChange(refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener(LOCAL_JOURNALS_CHANGED, refresh)
      window.removeEventListener("trainoracle:account-journals-changed", refresh)
      unsubscribe()
    }
  }, [])
  return dates
}

/** Read-only paper and motif treatment for in-progress writers; it never makes form controls inert. */
export function JournalWritingDecorationPreview({ date, children }: {
  readonly date: string
  readonly children: React.ReactNode
}) {
  const activeDates = useActiveSavedDates()
  const state = useJournalDecorationSnapshot()
  const motif = selectJournalDecorationPreview(state, date, activeDates)
  const owned = state === null ? null : new Set(state.ownedItemIds)
  const equippedThemeId = state?.equipped.themeId ?? null
  const theme = equippedThemeId !== null && owned?.has(equippedThemeId)
    ? decorationCatalogItem(equippedThemeId) ?? null : null
  return (
    <div className="journal-writing-decoration-preview">
      {theme?.category === "THEME" && <img className="journal-writing-decoration-preview__theme"
        src={`${import.meta.env.BASE_URL}${theme.assetPath}`} alt="" aria-hidden="true" />}
      {motif !== null && <div className="journal-writing-decoration-preview__motif"><JournalDecorationPreview item={motif} /></div>}
      <div className="journal-writing-decoration-preview__content">{children}</div>
    </div>
  )
}
