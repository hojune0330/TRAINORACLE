import React from "react"
import { DecoratedJournalPageFrame } from "../../components/DecoratedJournalPageFrame"
import { JournalConfirmationDialog } from "../../components/JournalConfirmationDialog"
import {
  DECORATION_CATALOG,
  isPlacementDecorationId,
  isThemeDecorationId,
  loadDecorationState,
  saveDecorationState,
} from "../../domain/decorations"
import type { DecorationCatalogItem, DecorationSlot, DecorationState } from "../../domain/decorations"
import {
  applyJournalDecoration,
  previewJournalDecoration,
  removeJournalDecoration,
} from "../../domain/journal-decoration-state"
import { JournalDecorationToolbar } from "./JournalDecorationToolbar"

type Replacement = {
  readonly item: DecorationCatalogItem
  readonly previous: DecorationCatalogItem
  readonly slot: DecorationSlot
}

export function JournalDecorationSurface({
  date,
  hasEntries,
  children,
}: {
  readonly date: string
  readonly hasEntries: boolean
  readonly children: React.ReactNode
}) {
  const [canonical, setCanonical] = React.useState(loadDecorationState)
  const [preview, setPreview] = React.useState<DecorationState | null>(null)
  const [open, setOpen] = React.useState(false)
  const [notice, setNotice] = React.useState("")
  const [undoState, setUndoState] = React.useState<DecorationState | null>(null)
  const [replacement, setReplacement] = React.useState<Replacement | null>(null)
  const [previewItemId, setPreviewItemId] = React.useState<string | null>(null)
  const visible = preview ?? canonical
  const items = DECORATION_CATALOG.filter((item) => (
    isThemeDecorationId(item.id)
    || (hasEntries && isPlacementDecorationId(item.id) && canonical.ownedItemIds.includes(item.id))
  ))
  const activeItemIds = new Set<string>([
    ...canonical.ownedItemIds.map((itemId) => `owned:${itemId}`),
    canonical.equipped.themeId,
    ...canonical.pagePlacements.filter((placement) => placement.date === date).map((placement) => placement.itemId),
  ])

  const commit = (next: DecorationState | null, successMessage: string): boolean => {
    if (next === null || !saveDecorationState(next).ok) {
      setPreview(null)
      setPreviewItemId(null)
      setNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
      return false
    }
    setUndoState(canonical)
    setCanonical(next)
    setPreview(null)
    setPreviewItemId(null)
    setNotice(successMessage)
    return true
  }

  const apply = (item: DecorationCatalogItem, slot?: DecorationSlot): void => {
    if (slot !== undefined) {
      const current = canonical.pagePlacements.find((placement) => placement.date === date && placement.slot === slot)
      const previous = current === undefined ? undefined : DECORATION_CATALOG.find((candidate) => candidate.id === current.itemId)
      if (previous !== undefined && previous.id !== item.id) {
        setReplacement({ item, previous, slot })
        return
      }
    }
    commit(applyJournalDecoration(canonical, item, date, slot), `${item.name}을 저장했어요.`)
  }

  const close = (): void => {
    setOpen(false)
    setPreview(null)
    setPreviewItemId(null)
    setReplacement(null)
    setNotice("")
  }

  return (
    <>
      <JournalDecorationToolbar
        hasEntries={hasEntries}
        items={items}
        open={open}
        activeItemIds={activeItemIds}
        canUndo={undoState !== null}
        notice={notice}
        previewItemId={previewItemId}
        onOpen={() => setOpen(true)}
        onClose={close}
        onPreview={(item, slot) => {
          setPreview(previewJournalDecoration(canonical, item, date, slot))
          setPreviewItemId(item.id)
          setNotice("")
        }}
        onApply={apply}
        onRemove={(item) => commit(removeJournalDecoration(canonical, item, date), `${item.name}을 제거했어요.`)}
        onUndo={() => {
          const previous = undoState
          if (previous !== null && saveDecorationState(previous).ok) {
            setCanonical(previous)
            setPreview(null)
            setUndoState(null)
            setPreviewItemId(null)
            setNotice("이전 꾸미기로 되돌렸어요.")
          } else {
            setNotice("꾸미기를 저장하지 못했어요. 일지는 그대로예요.")
          }
        }}
      />
      <DecoratedJournalPageFrame date={date} state={visible}>{children}</DecoratedJournalPageFrame>
      {replacement !== null && (
        <JournalConfirmationDialog
          title="꾸미기 교체 확인"
          description={`${replacement.previous.name} 대신 ${replacement.item.name}을 사용할까요?`}
          confirmLabel="교체하기"
          onCancel={() => setReplacement(null)}
          onConfirm={() => {
            const ok = commit(
              applyJournalDecoration(canonical, replacement.item, date, replacement.slot),
              `${replacement.item.name}으로 교체했어요.`,
            )
            if (ok) setReplacement(null)
            return ok
          }}
        />
      )}
    </>
  )
}
