import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DECORATION_CATALOG } from "../../domain/decoration-catalog"
import { OPEN_CUTE_V1 } from "../../domain/decoration-collections"
import { JournalDecorationToolbar } from "./JournalDecorationToolbar"

const collectionItems = DECORATION_CATALOG.filter((item) => item.collection === OPEN_CUTE_V1.id)
const purchasableItemIds = new Set(collectionItems.map((item) => item.id))
const noop = vi.fn()

afterEach(() => cleanup())

function renderToolbar(
  bundlePurchasesEnabled: boolean,
  options: { calendarMode?: boolean; materialsFooter?: ReactNode; items?: typeof collectionItems } = {},
) {
  const items = options.items ?? collectionItems
  return render(
    <JournalDecorationToolbar
      hasEntries
      items={items}
      open
      drawerOpen
      activeItemIds={new Set()}
      availablePoints={999}
      bundlePurchasesEnabled={bundlePurchasesEnabled}
      purchasableItemIds={purchasableItemIds}
      pageItemCounts={new Map()}
      canUndo={false}
      canRedo={false}
      selectedIndex={null}
      placementCount={0}
      clipboardAvailable={false}
      notice=""
      previewItemId={null}
      today="2026-09-11"
      onApply={noop}
      onPurchase={noop}
      onPurchaseBundle={noop}
      onClose={noop}
      onDrawerClose={noop}
      onDrawerOpen={noop}
      onOpen={noop}
      onPreview={noop}
      onPreviewEnd={noop}
      onUnavailable={noop}
      onClearAvatar={noop}
      onUndo={noop}
      onRedo={noop}
      onMoveBackward={noop}
      onMoveForward={noop}
      onCopySelected={noop}
      onPaste={noop}
      calendarMode={options.calendarMode}
      materialsFooter={options.materialsFooter}
    />,
  )
}

describe("JournalDecorationToolbar account purchase boundary", () => {
  it("hides collection bundle purchases when the account server cannot validate bundle pricing", () => {
    renderToolbar(false)
    fireEvent.click(screen.getByRole("button", { name: /귀여운 스티커 28종 보기/u }))
    expect(screen.queryByRole("button", { name: /한 번에 받기/u })).not.toBeInTheDocument()
  })

  it("keeps collection bundle purchases available in device-only mode", () => {
    renderToolbar(true)
    fireEvent.click(screen.getByRole("button", { name: /귀여운 스티커 28종 보기/u }))
    expect(screen.getByRole("button", { name: /한 번에 받기/u })).toBeInTheDocument()
  })
})

describe("JournalDecorationToolbar material presentation", () => {
  it("marks existing collection artwork for optical sizing without changing item identity", () => {
    const { container } = renderToolbar(false)
    fireEvent.click(screen.getByRole("button", { name: /귀여운 스티커 28종 보기/u }))

    const collectionPreviews = container.querySelectorAll(
      '.journal-decoration-toolbar__material-preview[data-collection="true"]',
    )
    expect(collectionPreviews).toHaveLength(collectionItems.length)
    expect(within(container).getByRole("button", { name: /콧노래 친구 4P로 받기/u })).toBeInTheDocument()
  })

  it("limits calendar materials to margin-safe categories and keeps the footer after the catalog", () => {
    const allCalendarCandidateItems = DECORATION_CATALOG.filter((item) =>
      ["THEME", "STICKER", "STAMP", "TAPE", "EMOJI_STICKER", "AVATAR", "INK"].includes(item.category),
    )
    const footer = <p data-testid="calendar-materials-footer">달력 꾸미기 적용 안내</p>
    const { container } = renderToolbar(true, {
      calendarMode: true,
      items: allCalendarCandidateItems,
      materialsFooter: footer,
    })

    expect(screen.queryByRole("navigation", { name: /^일지 꾸미기 도구$/u })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^테마$/u })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^스티커$/u })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^아바타$/u })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^글자색$/u })).not.toBeInTheDocument()
    expect(screen.getByTestId("calendar-materials-footer")).toBeInTheDocument()

    const drawer = container.querySelector(".journal-decoration-toolbar")
    expect(drawer?.lastElementChild).toHaveAttribute("data-testid", "calendar-materials-footer")
  })
})
