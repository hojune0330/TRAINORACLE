import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DECORATION_CATALOG } from "../../domain/decoration-catalog"
import { OPEN_CUTE_V1 } from "../../domain/decoration-collections"
import { JournalDecorationToolbar } from "./JournalDecorationToolbar"

const collectionItems = DECORATION_CATALOG.filter((item) => item.collection === OPEN_CUTE_V1.id)
const purchasableItemIds = new Set(collectionItems.map((item) => item.id))
const noop = vi.fn()

function renderToolbar(bundlePurchasesEnabled: boolean) {
  return render(
    <JournalDecorationToolbar
      hasEntries
      items={collectionItems}
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
})
