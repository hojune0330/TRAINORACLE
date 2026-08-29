import React from "react"
import { DECORATION_SLOTS, decorationCatalogItem } from "../domain/decorations"
import type {
  DecorationCatalogItem,
  DecorationSlot,
  DecorationState,
} from "../domain/decorations"

type DecoratedJournalPageFrameProps = {
  readonly date: string
  readonly state: DecorationState
  readonly children: React.ReactNode
}

const SLOT_TEST_IDS = {
  HEADER_TAPE: "journal-slot-header-tape",
  TOP_CORNER: "journal-slot-top-corner",
  BODY_MARGIN: "journal-slot-body-margin",
  PAGE_FOOTER: "journal-slot-page-footer",
} as const satisfies Record<DecorationSlot, string>

function DecorationAsset({
  item,
  className,
  testId,
}: {
  readonly item: DecorationCatalogItem
  readonly className: string
  readonly testId: string
}) {
  const [failed, setFailed] = React.useState(false)
  if (failed) {
    return (
      <span className={`${className} decorated-journal-page__asset-fallback`} data-testid={testId} aria-hidden="true">
        {item.fallbackLabel}
      </span>
    )
  }
  return (
    <img
      className={className}
      data-testid={testId}
      src={`${import.meta.env.BASE_URL}${item.assetPath}`}
      alt=""
      onError={() => setFailed(true)}
    />
  )
}

export function DecoratedJournalPageFrame({ date, state, children }: DecoratedJournalPageFrameProps) {
  const theme = decorationCatalogItem(state.equipped.themeId)
  const avatar = state.equipped.avatarId === null
    ? undefined
    : decorationCatalogItem(state.equipped.avatarId)
  const placements = DECORATION_SLOTS.flatMap((slot) => {
    const placement = state.pagePlacements.find((candidate) => candidate.date === date && candidate.slot === slot)
    if (placement === undefined) return []
    const item = decorationCatalogItem(placement.itemId)
    return item === undefined ? [] : [{ item, slot }]
  })
  const placementFor = (slot: DecorationSlot) => placements.find((placement) => placement.slot === slot)
  const headerTape = placementFor("HEADER_TAPE")
  const topCorner = placementFor("TOP_CORNER")
  const bodyMargin = placementFor("BODY_MARGIN")
  const pageFooter = placementFor("PAGE_FOOTER")
  const hasTopRail = avatar !== undefined || headerTape !== undefined || topCorner !== undefined

  return (
    <section
      className="decorated-journal-page"
      data-theme-id={state.equipped.themeId}
      data-ink-id={state.equipped.inkId}
    >
      {theme !== undefined && (
        <DecorationAsset item={theme} className="decorated-journal-page__theme" testId="journal-page-theme" />
      )}
      {hasTopRail && (
        <div className="decorated-journal-page__top-rail" aria-hidden="true">
          <span>{avatar !== undefined && <DecorationAsset item={avatar} className="decorated-journal-page__avatar" testId="journal-page-avatar" />}</span>
          <span>{headerTape !== undefined && <DecorationAsset item={headerTape.item} className="decorated-journal-page__slot decorated-journal-page__slot--header-tape" testId={SLOT_TEST_IDS.HEADER_TAPE} />}</span>
          <span>{topCorner !== undefined && <DecorationAsset item={topCorner.item} className="decorated-journal-page__slot decorated-journal-page__slot--top-corner" testId={SLOT_TEST_IDS.TOP_CORNER} />}</span>
        </div>
      )}
      <div className="decorated-journal-page__body" data-has-side-rail={bodyMargin !== undefined ? "true" : undefined}>
        <div key={date} className="decorated-journal-page__content journal-reader-page" data-testid="decorated-journal-content">
          {children}
        </div>
        {bodyMargin !== undefined && (
          <aside className="decorated-journal-page__side-rail" aria-hidden="true">
            <DecorationAsset item={bodyMargin.item} className="decorated-journal-page__slot decorated-journal-page__slot--body-margin" testId={SLOT_TEST_IDS.BODY_MARGIN} />
          </aside>
        )}
      </div>
      {pageFooter !== undefined && (
        <div className="decorated-journal-page__footer-rail" aria-hidden="true">
          <DecorationAsset item={pageFooter.item} className="decorated-journal-page__slot decorated-journal-page__slot--page-footer" testId={SLOT_TEST_IDS.PAGE_FOOTER} />
        </div>
      )}
    </section>
  )
}
